
import {availableParallelism} from "node:os";
import {Worker} from "node:worker_threads";
import path from "node:path";

//Limites de Trabajadores y Cola
function leerLimite(valor: string | undefined, defecto: number, permiteCero=false): number {
    const n = Number(valor);
    if (valor === undefined || !Number.isInteger(n) || n < (permiteCero ? 0 : 1)) {
        return defecto;
    }
    return n;
}
const max_Trabajadores = leerLimite(process.env.MAX_TRABAJADORES, availableParallelism());
const maxCola = leerLimite(process.env.MAX_COLA, max_Trabajadores * 2, true);

//Datos de los trabajos pendientes
interface Trabajo {
    n:number;
    resolver: (total:number) => void;
    rechazar: (error:Error) => void;
}
const cola: Trabajo[] = [];
let activos = 0;
let rechazados = 0;

//Despachador de trabajadores
function despachar(): void {
    while (activos < max_Trabajadores && cola.length > 0){
        const trabajo = cola.shift()!;
        activos++;
        const archivo = path.join(__dirname, "worker-reporte.js");
        try{
            const worker = new Worker(archivo,{workerData: {n: trabajo.n}});
            let resultado: number | undefined;
            let terminado = false;
            let errorWorker: Error | undefined;
            function finalizar(error?:Error): void {
                if (terminado) return;
                terminado = true;
                activos--;
                if (error) {
                    trabajo.rechazar(error);
                } else if (resultado === undefined) {
                    trabajo.rechazar(new Error("El worker no devolvio un resultado"));
                } else {
                    trabajo.resolver(resultado);
                }
                despachar();
            }
            worker.once("message", (mensaje:number) => {
                 if (typeof mensaje === "number" && Number.isFinite(mensaje)) {
                    resultado = mensaje;
             }
        });
            worker.once("error", (error:Error) => {
                errorWorker = error;
            });
            worker.once("exit", (codigo)=>{
                if (errorWorker) {
                    finalizar(errorWorker);
                } else if (codigo !== 0) {
                    finalizar(new Error("Worker finalizo con codigo " + codigo));
                } else {
                    finalizar();
                }
            });
        } catch (error) {
            activos--;
            trabajo.rechazar(error as Error);
        }
    }
}

//Solicitar reporte al pool
export function contarPrimosEnPool(n: number): Promise<number>{
    return new Promise((resolver, rechazar) =>{
        if (activos >= max_Trabajadores && cola.length >= maxCola){
            rechazados++;
            const error = new Error("El pool esta lleno");
            error.name = "PoolLleno";
            rechazar(error);
            return;
        }
        cola.push({n, resolver, rechazar});
        despachar();
    });
}

export function estadoPool(){
    return {
        maxTrabajadores: max_Trabajadores,
        activos,
        enCola: cola.length,
        maxCola,
        rechazadas: rechazados
    };
}
