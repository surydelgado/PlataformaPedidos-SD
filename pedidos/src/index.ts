
import express, {Request, Response} from "express";
import {randomUUID} from "node:crypto"; //Para generar valores aleatorios

const PORT = Number(process.env.PORT ?? 3000);
const INVENTARIO_URL = process.env.INVENTARIO_URL ?? "http://localhost:3001";
const TIMEOUT_MS = Number(process.env.TIMEOUT_MS ?? 2000);

interface Pedido {
    id: string;
    sku: string;
    cantidad: number;
    creadoen: string;
}

const pedidos: Pedido[] = [];
const app = express();

app.disable("x-powered-by");
app.use(express.json());

// Consulta Salud del Servicio
app.get("/health", (_req: Request, res: Response) => {
    res.json({status: "ok", servicio: "Pedidos"});
});

// Comprobar si Pedidos está listo
app.get("/health/ready", async (_req: Request, res: Response) => {
    const inicio = performance.now();

    try {
        const r = await fetch(`${INVENTARIO_URL}/health`, {
            signal: AbortSignal.timeout(1000),
        });

        const ms = Math.round(performance.now() - inicio);

        if (!r.ok) {
            res.status(503).json({
                status: "no-listo",
                inventario: "HTTP " + r.status,
                ms
            });
            return;
        }

        res.status(200).json({
            status: "listo",
            inventario: "ok",
            ms
        });

    } catch (error) {
        const ms = Math.round(performance.now() - inicio);
        const e = error as Error;

        const motivo = e.name === "TimeoutError"
            ? "timeout"
            : "sin conexión";

        res.status(503).json({
            status: "no-listo",
            inventario: motivo,
            ms
        });
    }
});

// Listado de Pedidos
app.get("/pedidos", (_req: Request, res: Response) => {
    res.json(pedidos);
});

// Servicio de Ingreso de Pedidos
app.post("/pedidos", async (req: Request, res: Response) => {
    const {sku, cantidad} = req.body ?? {};

    if (typeof sku !== "string" || typeof cantidad !== "number" || cantidad <= 0) {
        res.status(400).json({error: "Datos inválidos para el pedido o Cantidad inválida"});
        return;
    }

    const inicio = performance.now();

    try {
        const r = await fetch(`${INVENTARIO_URL}/stock/${encodeURIComponent(sku)}/reservar`, {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({cantidad}),
            signal: AbortSignal.timeout(TIMEOUT_MS),
        });

        if (r.status === 404) {
            res.status(404).json({error: "Producto no encontrado en inventario"});
            return;
        }

        if (r.status === 409) {
            res.status(409).json(await r.json());
            return;
        }

        if (!r.ok) {
            res.status(r.status).json(await r.json());
            return;
        }

        const pedido: Pedido = {
            id: randomUUID(),
            sku,
            cantidad,
            creadoen: new Date().toISOString()
        };

        pedidos.push(pedido);
        res.status(201).json(pedido);

    } catch (error) {
        const duracionMs = Math.round(performance.now() - inicio);
        const e = error as Error & {cause?: {code?: string}};

        const motivo = e.name === "TimeoutError"
            ? "Inventario no respondió en: " + TIMEOUT_MS + " ms"
            : e.cause?.code ?? e.message;

        console.error(motivo);

        res.status(503).json({
            error: "Inventario no disponible: " + motivo,
            duracionMs
        });
    }
});

app.listen(PORT, () => {
    console.log(`Servicio de pedidos escuchando en el puerto ${PORT} + Inventario en ${INVENTARIO_URL} + Timeout de ${TIMEOUT_MS} ms`);
});
