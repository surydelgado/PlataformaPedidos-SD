
# Bitácora · Arquitecturas y procesos · Sury Delgado

## Entorno

| Dato | Valor |
| --- | --- |
| Laptop (CPU, RAM) | ASUS TUF Gaming F15, Intel Core i7-12700H de 12.ª generación, 15,6 GB de RAM |
| Núcleos según `/metricas` | 20 |
| MAX_TRABAJADORES y MAX_COLA | 20 trabajadores y 40 espacios en cola (predeterminados) |
| Configuración adicional | 4 trabajadores y 8 espacios en cola |
| Duración de un reporte con n=2000000 | 295 ms |
| Herramientas utilizadas | Docker Compose, Node.js, TypeScript, PowerShell y autocannon 8 |

## 1. Resultados

Se realizaron los tres escenarios solicitados con autocannon. Antes de cada escenario se reinició el servicio Pedidos para limpiar las métricas anteriores. También se realizó una prueba adicional de saturación para comprobar el comportamiento del pool cuando se llena.

| Escenario | Latencia 50 % | Latencia máx. | Respuestas 2xx | Respuestas 503 | Timeouts | bucle.maxMs |
| --- | --- | --- | --- | --- | --- | --- |
| 1 · bloqueo (/health) | 2 ms | 157 ms | No desglosadas (~91 mil solicitudes) | No observadas | No reportados | 1911 ms |
| 2 · worker sin límite | 1840 ms | 3080 ms | No desglosadas (573 solicitudes) | No desglosadas | No reportados | 245 ms |
| 3 · pool con límite (20/40) | 1667 ms | 2339 ms | No desglosadas (634 solicitudes) | 0 rechazos por saturación | No reportados | 85 ms |

**Observación:** En las tres pruebas originales, autocannon no mostró un desglose de respuestas 2xx ni de errores por timeout. Por eso se registran como no reportados, sin asumir valores que no aparecen en los resultados. Tampoco se deben confundir las solicitudes indicadas por autocannon con las respuestas finalizadas que registra el interceptor.

### Escenario 1 · Bloqueo del bucle de eventos

Se ejecutó autocannon con 20 conexiones durante 15 segundos sobre `/health`. Mientras se realizaba la prueba se solicitaron dos reportes bloqueantes.

**Comandos utilizados:**

```powershell
docker compose restart pedidos

npx.cmd -y autocannon@8 -c 20 -d 15 http://localhost:3000/health
```

En otra terminal:

```powershell
Invoke-RestMethod http://localhost:3000/reporte/bloqueante

Invoke-RestMethod http://localhost:3000/reporte/bloqueante
```

**Resultados de los reportes bloqueantes:**

| Reporte | n | Primos | Duración |
| --- | --- | --- | --- |
| Primero | 8000000 | 539777 | 1884 ms |
| Segundo | 8000000 | 539777 | 1900 ms |

**Salida de autocannon:**

```text
Running 15s test @ http://localhost:3000/health
20 connections

┌─────────┬──────┬──────┬───────┬───────┬─────────┬─────────┬────────┐
│ Stat    │ 2.5% │ 50%  │ 97.5% │ 99%   │ Avg     │ Stdev   │ Max    │
├─────────┼──────┼──────┼───────┼───────┼─────────┼─────────┼────────┤
│ Latency │ 1 ms │ 2 ms │ 10 ms │ 15 ms │ 2.77 ms │ 3.23 ms │ 157 ms │
└─────────┴──────┴──────┴───────┴───────┴─────────┴─────────┴────────┘

┌───────────┬────────┬────────┬─────────┬─────────┬──────────┬──────────┬────────┐
│ Stat      │ 1%     │ 2.5%   │ 50%     │ 97.5%   │ Avg      │ Stdev    │ Min    │
├───────────┼────────┼────────┼─────────┼─────────┼──────────┼──────────┼────────┤
│ Req/Sec   │ 2,443  │ 2,443  │ 6,627   │ 9,095   │ 6,095.74 │ 2,333.15 │ 2,442  │
├───────────┼────────┼────────┼─────────┼─────────┼──────────┼──────────┼────────┤
│ Bytes/Sec │ 606 kB │ 606 kB │ 1.64 MB │ 2.25 MB │ 1.51 MB  │ 578 kB   │ 606 kB │
└───────────┴────────┴────────┴─────────┴─────────┴──────────┴──────────┴────────┘

Req/Bytes counts sampled once per second.
# of samples: 15

91k requests in 15.03s, 22.7 MB read
```

**Respuesta de `/metricas`:**

```json
{
  "umbralLentaMs": 1000,
  "rutas": [
    {
      "ruta": "GET /health",
      "peticiones": 91439,
      "promedioMs": 0.0110128063517755,
      "maxMs": 15,
      "lentas": 0
    },
    {
      "ruta": "GET /reporte/bloqueante",
      "peticiones": 2,
      "promedioMs": 1894.5,
      "maxMs": 1900,
      "lentas": 2
    }
  ],
  "bucle": {
    "p50Ms": 10,
    "p99Ms": 13,
    "maxMs": 1911
  },
  "nucleos": 20,
  "pool": {
    "maxTrabajadores": 20,
    "activos": 0,
    "enCola": 0,
    "maxCola": 40,
    "rechazadas": 0
  }
}
```

### Escenario 2 · Worker sin límite

Se ejecutó autocannon con 50 conexiones durante 20 segundos sobre `/reporte/worker?n=2000000`.

En este escenario cada petición crea un worker nuevo, sin utilizar un límite de trabajadores.

**Comandos utilizados:**

```powershell
docker compose restart pedidos

npx.cmd -y autocannon@8 -c 50 -d 20 "http://localhost:3000/reporte/worker?n=2000000"
```

**Salida de autocannon:**

```text
Running 20s test @ http://localhost:3000/reporte/worker?n=2000000
50 connections

┌─────────┬────────┬─────────┬─────────┬─────────┬────────────┬───────────┬─────────┐
│ Stat    │ 2.5%   │ 50%     │ 97.5%   │ 99%     │ Avg        │ Stdev     │ Max     │
├─────────┼────────┼─────────┼─────────┼─────────┼────────────┼───────────┼─────────┤
│ Latency │ 861 ms │ 1840 ms │ 2771 ms │ 2881 ms │ 1817.48 ms │ 528.97 ms │ 3080 ms │
└─────────┴────────┴─────────┴─────────┴─────────┴────────────┴───────────┴─────────┘

┌───────────┬───────┬───────┬────────┬─────────┬─────────┬─────────┬───────┐
│ Stat      │ 1%    │ 2.5%  │ 50%    │ 97.5%   │ Avg     │ Stdev   │ Min   │
├───────────┼───────┼───────┼────────┼─────────┼─────────┼─────────┼───────┤
│ Req/Sec   │ 3     │ 3     │ 28     │ 52      │ 26.15   │ 11.86   │ 3     │
├───────────┼───────┼───────┼────────┼─────────┼─────────┼─────────┼───────┤
│ Bytes/Sec │ 822 B │ 822 B │ 7.7 kB │ 14.3 kB │ 7.19 kB │ 3.26 kB │ 822 B │
└───────────┴───────┴───────┴────────┴─────────┴─────────┴─────────┴───────┘

Req/Bytes counts sampled once per second.
# of samples: 20

573 requests in 20.17s, 144 kB read
```

**Respuesta de `/metricas`:**

```json
{
  "umbralLentaMs": 1000,
  "rutas": [
    {
      "ruta": "GET /reporte/worker",
      "peticiones": 523,
      "promedioMs": 1768.35564053537,
      "maxMs": 3007,
      "lentas": 492
    }
  ],
  "bucle": {
    "p50Ms": 10,
    "p99Ms": 37,
    "maxMs": 245
  },
  "nucleos": 20,
  "pool": {
    "maxTrabajadores": 20,
    "activos": 0,
    "enCola": 0,
    "maxCola": 40,
    "rechazadas": 0
  }
}
```

### Escenario 3 · Pool con límite

Se ejecutó autocannon con 50 conexiones durante 20 segundos sobre `/reporte/pool?n=2000000`.

Se utilizó la configuración predeterminada de 20 trabajadores y 40 espacios en cola.

**Comandos utilizados:**

```powershell
docker compose restart pedidos

npx.cmd -y autocannon@8 -c 50 -d 20 "http://localhost:3000/reporte/pool?n=2000000"
```

**Salida de autocannon:**

```text
Running 20s test @ http://localhost:3000/reporte/pool?n=2000000
50 connections

┌─────────┬────────┬─────────┬─────────┬─────────┬────────────┬──────────┬─────────┐
│ Stat    │ 2.5%   │ 50%     │ 97.5%   │ 99%     │ Avg        │ Stdev    │ Max     │
├─────────┼────────┼─────────┼─────────┼─────────┼────────────┼──────────┼─────────┤
│ Latency │ 922 ms │ 1667 ms │ 2060 ms │ 2257 ms │ 1658.22 ms │ 242.2 ms │ 2339 ms │
└─────────┴────────┴─────────┴─────────┴─────────┴────────────┴──────────┴─────────┘

┌───────────┬─────────┬─────────┬─────────┬─────────┬─────────┬────────┬─────────┐
│ Stat      │ 1%      │ 2.5%    │ 50%     │ 97.5%   │ Avg     │ Stdev  │ Min     │
├───────────┼─────────┼─────────┼─────────┼─────────┼─────────┼────────┼─────────┤
│ Req/Sec   │ 20      │ 20      │ 28      │ 37      │ 29.2    │ 5.13   │ 20      │
├───────────┼─────────┼─────────┼─────────┼─────────┼─────────┼─────────┼─────────┤
│ Bytes/Sec │ 5.44 kB │ 5.44 kB │ 7.65 kB │ 10.1 kB │ 7.97 kB │ 1.4 kB │ 5.44 kB │
└───────────┴─────────┴─────────┴─────────┴─────────┴─────────┴─────────┴─────────┘

Req/Bytes counts sampled once per second.
# of samples: 20

634 requests in 20.18s, 159 kB read
```

**Respuesta de `/metricas`:**

```json
{
  "umbralLentaMs": 1000,
  "rutas": [
    {
      "ruta": "GET /reporte/pool",
      "peticiones": 585,
      "promedioMs": 1648.30769230769,
      "maxMs": 2196,
      "lentas": 565
    }
  ],
  "bucle": {
    "p50Ms": 10,
    "p99Ms": 15,
    "maxMs": 85
  },
  "nucleos": 20,
  "pool": {
    "maxTrabajadores": 20,
    "activos": 0,
    "enCola": 0,
    "maxCola": 40,
    "rechazadas": 0
  }
}
```

### Prueba adicional · Saturación del pool

Como en el escenario 3 no se produjeron rechazos, se realizó una prueba adicional con límites más pequeños para comprobar el funcionamiento de `PoolLleno`.

Se configuraron temporalmente las variables `MAX_TRABAJADORES=4` y `MAX_COLA=8` en Docker Compose.

**Configuración utilizada:**

```yaml
pedidos:
  build: ./pedidos
  environment:
    - INVENTARIO_URL=http://inventario:3001
    - MAX_TRABAJADORES=4
    - MAX_COLA=8
  ports:
    - "3000:3000"
```

Después se recreó el servicio y se realizó la prueba.

**Comandos utilizados:**

```powershell
docker compose up -d --build --force-recreate pedidos

docker compose restart pedidos

npx.cmd -y autocannon@8 -c 50 -d 20 "http://localhost:3000/reporte/pool?n=2000000"
```

**Salida de autocannon:**

```text
Running 20s test @ http://localhost:3000/reporte/pool?n=2000000
50 connections

┌─────────┬──────┬───────┬───────┬────────┬──────────┬───────────┬─────────┐
│ Stat    │ 2.5% │ 50%   │ 97.5% │ 99%    │ Avg      │ Stdev     │ Max     │
├─────────┼──────┼───────┼───────┼────────┼──────────┼───────────┼─────────┤
│ Latency │ 6 ms │ 17 ms │ 79 ms │ 130 ms │ 29.41 ms │ 110.07 ms │ 2418 ms │
└─────────┴──────┴───────┴───────┴────────┴──────────┴───────────┴─────────┘

┌───────────┬────────┬────────┬────────┬─────────┬─────────┬────────┬────────┐
│ Stat      │ 1%     │ 2.5%   │ 50%    │ 97.5%   │ Avg     │ Stdev  │ Min    │
├───────────┼────────┼────────┼────────┼─────────┼─────────┼────────┼────────┤
│ Req/Sec   │ 372    │ 372    │ 1,704  │ 3,377   │ 1,661.5 │ 665.75 │ 372    │
├───────────┼────────┼────────┼────────┼─────────┼─────────┼────────┼────────┤
│ Bytes/Sec │ 133 kB │ 133 kB │ 611 kB │ 1.21 MB │ 595 kB  │ 238 kB │ 133 kB │
└───────────┴────────┴────────┴────────┴─────────┴─────────┴────────┴────────┘

Req/Bytes counts sampled once per second.
# of samples: 20

147 2xx responses, 33080 non 2xx responses
33k requests in 20.12s, 11.9 MB read
```

**Respuesta de `/metricas` durante la carga:**

```json
{
  "umbralLentaMs": 1000,
  "rutas": [
    {
      "ruta": "GET /reporte/pool",
      "peticiones": 15570,
      "promedioMs": 6.06127167630058,
      "maxMs": 2399,
      "lentas": 60
    }
  ],
  "bucle": {
    "p50Ms": 10,
    "p99Ms": 61,
    "maxMs": 164
  },
  "nucleos": 20,
  "pool": {
    "maxTrabajadores": 4,
    "activos": 4,
    "enCola": 8,
    "maxCola": 8,
    "rechazadas": 15502
  }
}
```

Esta captura corresponde a un momento de la ejecución, no al contador final de toda la prueba.

**Comprobación de respuesta HTTP con curl:**

```powershell
curl.exe -i "http://localhost:3000/reporte/pool?n=2000000"
```

**Respuesta obtenida:**

```http
HTTP/1.1 503 Service Unavailable
Retry-After: 1
Content-Type: application/json; charset=utf-8

{"error":"El pool esta lleno","pool":{"maxTrabajadores":4,"activos":4,"enCola":8,"maxCola":8,"rechazadas":4182}}
```

Con esta prueba se comprobó que el pool limita los trabajadores y la cola, rechazando nuevas solicitudes cuando alcanza su capacidad.

Autocannon agrupó 33080 respuestas como non-2xx, sin desglosar todos sus códigos. La comprobación con curl permitió verificar directamente una respuesta 503 con la cabecera `Retry-After: 1`.

## 2. Análisis

### 1. En el escenario 1, ¿qué valor tuvo bucle.maxMs y cuál fue el maxMs de GET /health? ¿Por qué uno ve el bloqueo y el otro no?

En el primer escenario, `bucle.maxMs` fue de 1911 ms, mientras que el valor máximo de `GET /health` fue de 15 ms.
Los dos reportes bloqueantes tardaron 1884 ms y 1900 ms, ocupando el hilo principal durante esos cálculos.
El interceptor mide la duración de una petición desde que Express comienza a atenderla, por lo que no registra el tiempo que estuvo esperando antes.
En cambio, `monitorEventLoopDelay` permite detectar los retrasos del bucle de eventos cuando el servidor se encuentra bloqueado.

### 2. En el escenario 2, ¿cuántas peticiones se completaron y cuántas terminaron en timeout? Si un reporte tarda menos de un segundo, ¿por qué con 50 a la vez pasa eso?

En el segundo escenario, autocannon mostró 573 solicitudes y el interceptor registró 523 respuestas finalizadas cuando se consultaron las métricas.
La salida obtenida no indicó explícitamente cuántas solicitudes terminaron en timeout, por lo que no se puede determinar ese número.
La latencia mediana fue de 1840 ms y la máxima alcanzó los 3080 ms, aunque una prueba individual había tardado aproximadamente 295 ms.
Esto sucede porque al ejecutar 50 peticiones al mismo tiempo se crean muchos workers que compiten por los recursos de la computadora.
Aunque los cálculos se ejecutan en hilos separados, la CPU y la memoria siguen siendo limitadas, lo que aumenta el tiempo de respuesta.

### 3. En el escenario 3, ¿cuántas respuestas fueron 2xx y cuántas 503? ¿Qué diferencia hay entre un 503 inmediato con Retry-After y un timeout?

En el escenario 3 original, autocannon registró 634 solicitudes, pero no mostró el desglose exacto de respuestas 2xx.
El pool registró cero rechazos por saturación, ya que podía atender 20 trabajos y mantener otros 40 en espera.
En la prueba adicional con límites de 4 trabajadores y 8 espacios se obtuvieron 147 respuestas 2xx y 33080 non-2xx.
También se comprobó una respuesta HTTP 503 con la cabecera `Retry-After: 1`.
Un error 503 representa un fallo explícito de disponibilidad temporal, mientras que un timeout es un fallo por ausencia de respuesta dentro del tiempo esperado.
Con el 503 el cliente sabe que debe esperar antes de reintentar; con el timeout existe incertidumbre sobre si la solicitud llegó a procesarse.

### 4. Autocannon ignora Retry-After y reintenta enseguida. ¿Qué efecto tuvo eso en el servidor y qué debería hacer un cliente bien diseñado?

En la prueba adicional, autocannon continuó enviando solicitudes aunque el pool estuviera lleno y respondiera con HTTP 503.
Esto produjo 33080 respuestas non-2xx frente a solamente 147 respuestas exitosas durante los 20 segundos de la prueba.
La latencia mediana bajó a 17 ms porque muchas peticiones fueron rechazadas rápidamente, no porque el cálculo se realizara más rápido.
El pool evitó que se crearan trabajadores ilimitados, manteniendo solamente cuatro activos y ocho trabajos en espera.
Un cliente bien diseñado debería respetar `Retry-After`, esperar antes de reintentar y limitar la cantidad de nuevos intentos.
También podría utilizar una espera progresiva para evitar volver a saturar el servidor.

### 5. Las métricas y la cola viven en la memoria del proceso. Con 3 réplicas de Pedidos detrás de un balanceador, ¿qué mostraría /metricas y cuántos reportes simultáneos habría en total? ¿Qué cambiarías?

Si existieran tres réplicas de Pedidos, cada una tendría sus propias métricas y su propia cola de trabajadores en memoria.
Por eso, `/metricas` mostraría solamente los datos de la réplica que atendió la petición y no los resultados globales del sistema.
Con la configuración original de 20 trabajadores por réplica, podrían ejecutarse hasta 60 reportes simultáneamente entre las tres.
Además, existiría capacidad para mantener 120 reportes esperando, considerando 40 espacios de cola por cada réplica.
El balanceador podría enviar más solicitudes a una réplica que a otra, provocando saturación aunque todavía exista capacidad en otros procesos.
Para mejorar el sistema utilizaría una cola compartida y métricas centralizadas, además de límites de concurrencia coordinados entre las réplicas.

## 3. Problemas encontrados

Durante el desarrollo se presentaron algunos errores al integrar las métricas y el pool de trabajadores.

Uno de los primeros problemas fue un error de escritura en `availableParallelism()`, que impedía compilar el proyecto con Docker. Se corrigió el nombre de la función y se reconstruyó el servicio.

También se encontró un error al calcular los percentiles del bucle de eventos. Inicialmente se dividía el número del percentil entre `1e6`, cuando lo correcto era dividir el resultado obtenido de `percentile(50)` y `percentile(99)` para convertirlo de nanosegundos a milisegundos.

Otro problema ocurrió en la comunicación con `worker-reporte.ts`. El pool esperaba recibir un objeto con la propiedad `total`, pero el worker devolvía directamente un número. Esto provocaba el mensaje "El worker no devolvio un resultado". Se corrigió la recepción del mensaje en `pool.ts` y `index.ts`, manteniendo el archivo `worker-reporte.ts` sin cambios.

Durante las pruebas también se observó que el número de solicitudes indicado por autocannon no coincidía exactamente con las respuestas finalizadas registradas por el interceptor. Como no se mostraron errores de timeout explícitos, no se consideró esa diferencia como una cantidad confirmada de timeouts.

Finalmente, con la configuración original de 20 trabajadores y 40 espacios en cola no se produjeron rechazos, porque el pool tenía capacidad suficiente para las 50 conexiones concurrentes. Por eso se realizó una prueba adicional con cuatro trabajadores y ocho espacios de espera. Esta comprobación permitió observar las respuestas HTTP 503 y verificar la cabecera `Retry-After: 1`.

### 4. Uso declarado de IA

Durante esta actividad utilicé ChatGPT como apoyo para entender mejor cómo funciona el pool de trabajadores, especialmente la gestión de la cola y los límites de concurrencia. También me ayudó a identificar y corregir algunos errores de sintaxis durante el desarrollo y a organizar los resultados obtenidos en las pruebas. Las pruebas las realicé en mi computadora utilizando Docker y autocannon. 