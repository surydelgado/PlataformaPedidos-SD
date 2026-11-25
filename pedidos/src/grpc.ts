import path from "node:path";
import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";

const INVENTARIO_GRPC = process.env.INVENTARIO_GRPC ?? "localhost:50051";
const PLAZO_MS = Number(process.env.TIMEOUT_MS ?? 1000);

const definicion = protoLoader.loadSync(
    path.join(__dirname, "../proto/inventario.proto"),
    {
        keepCase: true,
        defaults: true,
    }
);

const paquete = grpc.loadPackageDefinition(definicion) as any;

const inventario = new paquete.inventario.Inventario(
    INVENTARIO_GRPC,
    grpc.credentials.createInsecure()
);

export function llamar<T>(metodo: string, peticion: object): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        const plazo = new Date(Date.now() + PLAZO_MS);

        inventario[metodo](
            peticion,
            { deadline: plazo },
            (err: grpc.ServiceError | null, respuesta: T) => {
                if (err) reject(err);
                else resolve(respuesta);
            }
        );
    });
}

const HTTP_DE: Record<number, number> = {
    [grpc.status.NOT_FOUND]: 404,
    [grpc.status.INVALID_ARGUMENT]: 400,
    [grpc.status.FAILED_PRECONDITION]: 409,
    [grpc.status.DEADLINE_EXCEEDED]: 504,
    [grpc.status.UNAVAILABLE]: 503,
    [grpc.status.INTERNAL]: 500,
};

export function aHttp(e: unknown) {
    const err = e as grpc.ServiceError;

    if (typeof err.code !== "number") {
        return {
            status: 500,
            cuerpo: { error: "Error interno", motivo: err.message }
        };
    }

    return {
        status: HTTP_DE[err.code] ?? 500,
        cuerpo: { error: grpc.status[err.code], motivo: err.details }
    };
}