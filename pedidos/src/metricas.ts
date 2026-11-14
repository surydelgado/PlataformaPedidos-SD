// Interceptor que mide cada petición (tarea en clase).
import { Request, Response, NextFunction } from "express";
import { monitorEventLoopDelay } from "node:perf_hooks";
import {availableParallelism} from "node:os";

const UMBRAL_LENTA_MS = Number(process.env.UMBRAL_LENTA_MS ?? 1000);

//Medir el retardo del bucle de eventos (event loop) con monitorEventLoopDelay
const retardoBucle = monitorEventLoopDelay({ resolution: 10 });
retardoBucle.enable();

interface Estadistica {
  peticiones: number;
  totalMs: number;
  maxMs: number;
  lentas: number;
}

const porRuta = new Map<string, Estadistica>();

export function medirLatencia(req: Request, res: Response, next: NextFunction): void {
  const inicio = performance.now();
  res.on("finish", () => {
    // TODO 1: calcula la duración en ms
    const duracionMs = Math.round(performance.now() - inicio);
    
    // TODO 2: busca la estadística de `${req.method} ${req.path}` (créala si no existe)
    const ruta = `${req.method} ${req.path}`;
    let estadistica = porRuta.get(ruta);
    if (!estadistica) {
      estadistica = { peticiones: 0, totalMs: 0, maxMs: 0, lentas: 0 };
      porRuta.set(ruta, estadistica);
    }
    // TODO 3: actualiza peticiones, totalMs, maxMs y lentas (ms > UMBRAL_LENTA_MS)
    estadistica.peticiones++;
    estadistica.totalMs += duracionMs;
    if (duracionMs > estadistica.maxMs) {
      estadistica.maxMs = duracionMs;
    }
    if (duracionMs > UMBRAL_LENTA_MS) {
      estadistica.lentas++;
    }   
  });
  next(); // sin next(), la petición nunca llega a la ruta
}

export function resumenMetricas() {
  // TODO 4: devuelve { umbralLentaMs, rutas: [{ ruta, peticiones, promedioMs, maxMs, lentas }] }
  return {
    umbralLentaMs: UMBRAL_LENTA_MS,
    rutas: Array.from(porRuta.entries()).map(([ruta, estadistica]) => ({
      ruta,
      peticiones: estadistica.peticiones,
      promedioMs: estadistica.totalMs / estadistica.peticiones,
      maxMs: estadistica.maxMs,
      lentas: estadistica.lentas
    })),

    bucle: {
      p50Ms : Math.round(retardoBucle.percentile(50 ) / 1e6),
      p99Ms : Math.round(retardoBucle.percentile(99) / 1e6),
      maxMs : Math.round(retardoBucle.max / 1e6),
    },

    nucleos: availableParallelism()
  };
}
