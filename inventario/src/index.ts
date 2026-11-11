
import express, {Request, Response} from "express";

const PORT = Number(process.env.PORT ?? 3001);
const RETARDO_MS = Number(process.env.RETARDO_MS ?? 0);

const stock = new Map<string, number>([
    ["Laptop", 10],
    ["Impresora Epson", 10],
    ["Mouse", 20],
    ["MOUSE-USB", 40],
    ["Teclado", 15],
]);

const esperar = (ms:number) => new Promise<void>((r) => setTimeout(r, ms));

const app = express();
app.disable("x-powered-by");
app.use(express.json());

app.get("/health", (_req: Request, res: Response) => {
    res.json({status: "ok", servicio: "Inventario"});
});

app.get("/stock/:sku", async (req: Request<{sku:string}>, res: Response) => {
    if (RETARDO_MS > 0) await esperar(RETARDO_MS);

    const disponible = stock.get(req.params.sku);

    if (disponible === undefined) {
        res.status(404).json({error: "Producto no encontrado: " + req.params.sku});
        return;
    }

    res.json({sku: req.params.sku, disponible});
});

// Reservar stock
app.post("/stock/:sku/reservar", async (req: Request<{sku:string}>, res: Response) => {
    const {cantidad} = req.body ?? {};
    const sku = req.params.sku;

    if (!Number.isInteger(cantidad) || cantidad <= 0) {
        res.status(400).json({error: "La cantidad debe ser un entero mayor que 0"});
        return;
    }

    if (!stock.has(sku)) {
        res.status(404).json({error: "Producto no encontrado: " + sku});
        return;
    }

    if (RETARDO_MS > 0) await esperar(RETARDO_MS);

    const disponible = stock.get(sku)!;

    if (disponible < cantidad) {
        res.status(409).json({error: "Stock insuficiente", disponible});
        return;
    }

    const restante = disponible - cantidad;
    stock.set(sku, restante);

    res.json({sku, reservado: cantidad, restante});
});

app.listen(PORT, () => {
    console.log(`Servicio de inventario escuchando en el puerto ${PORT} + Retardo de ${RETARDO_MS} ms`);
});
