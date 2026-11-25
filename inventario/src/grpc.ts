// Servidor GRPC
import path from "node:path";
import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";

const GRPC_PORT = Number(process.env.GRPC_PORT?? 50051);
const definicion = protoLoader.loadSync(path.join(__dirname,"../proto/inventario.proto"),{
    keepCase : true, //se van a usar los mismos campos del contrato
    defaults: true, //si un campo llega o no tiene por defecto 0
});

const paquete = grpc.loadPackageDefinition(definicion) as any;
interface SolicitudStock{
    sku : string;

}

interface Stock{
    sku : string;
    disponible : number;
}

interface SolicitudReserva{
    sku : string;
    cantidad : number;
}

interface Reserva{
    sku : string;
    reservado : number;
    restante : number;
}

const esperar = (ms:number) => new Promise<void>((r) => setTimeout(r, ms));

export function iniciarGrpc(stock: Map<string, number>, retardoMs: number) {
    async function consultarStock(
        call: grpc.ServerUnaryCall<SolicitudStock, Stock>,
        callback: grpc.sendUnaryData<Stock>
    ) {
        if (retardoMs > 0) await esperar(retardoMs);

        const sku = call.request.sku;
        const disponible = stock.get(sku);

        if (disponible === undefined) {
            callback({
                code: grpc.status.NOT_FOUND,
                details: "SKU no encontrado: " + sku
            });
            return;
        }

        callback(null, { sku, disponible });
    }

    async function reservar(
        call: grpc.ServerUnaryCall<SolicitudReserva, Reserva>,
        callback: grpc.sendUnaryData<Reserva>
    ) {
        if (retardoMs > 0) await esperar(retardoMs);

        const { sku, cantidad } = call.request;

        if (!Number.isInteger(cantidad) || cantidad <= 0) {
            callback({
                code: grpc.status.INVALID_ARGUMENT,
                details: "La cantidad debe ser un entero mayor que 0"
            });
            return;
        }

        const disponible = stock.get(sku);

        if (disponible === undefined) {
            callback({
                code: grpc.status.NOT_FOUND,
                details: "SKU no encontrado: " + sku
            });
            return;
        }

        if (disponible < cantidad) {
            callback({
                code: grpc.status.FAILED_PRECONDITION,
                details: "Stock insuficiente"
            });
            return;
        }

        const restante = disponible - cantidad;
        stock.set(sku, restante);

        callback(null, { sku, reservado: cantidad, restante });
    }

    const servidor = new grpc.Server();

    servidor.addService(paquete.inventario.Inventario.service, {
        ConsultarStock: consultarStock,
        Reservar: reservar,
    });

    servidor.bindAsync(
        `0.0.0.0:${GRPC_PORT}`,
        grpc.ServerCredentials.createInsecure(),
        (err) => {
            if (err) throw err;

            console.log(
                "gRPC de inventario escuchando en el puerto: " + GRPC_PORT
            );
        }
    );
}
