
# Métricas - Servicio de Pedidos

## Evidencia de `/health`

Código HTTP real: 200 OK

Tiempo real medido por el cliente: 26120 ms

## JSON completo de `/metricas`

```json
{
  "umbralLentaMs": 1000,
  "rutas": [
    {
      "ruta": "GET /health",
      "peticiones": 4,
      "promedioMs": 2,
      "maxMs": 5,
      "lentas": 0
    },
    {
      "ruta": "GET /reporte/bloqueante",
      "peticiones": 3,
      "promedioMs": 9444.333333333334,
      "maxMs": 27559,
      "lentas": 1
    }
  ]
}
```


## Diferencia entre la medición del cliente y el interceptor

Postman mide el tiempo total desde que envía la petición hasta que recibe la respuesta.
El interceptor mide desde que la petición entra al middleware de Express hasta que termina la respuesta.
El reporte bloqueante ocupa el hilo principal de Node.js, haciendo que otras peticiones tengan que esperar.
Por eso Postman registró 26.12 segundos para `/health`, mientras que el interceptor registró como máximo 5 ms.
El cliente experimenta una latencia elevada causada por el bloqueo del event loop, aunque finalmente recibe HTTP 200.


## Evidencias de las pruebas

### 1. Reporte bloqueante

![Reporte bloqueante](imagenes/reporte-bloqueante.png)

### 2. Petición Health

![Tiempo de respuesta de Health](imagenes/health.png)

### 3. Métricas del servicio

![Respuesta de métricas](imagenes/metricas.png)
