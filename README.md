# OpenTelemetry Agenda Instrumentation for Node.js

This module provides automatic tracing instrumentation for [Agenda](https://github.com/agenda/agenda).

Compatible with OpenTelemetry JS API and SDK `1.0+` and `agenda@4.x`

## Installation

```bash
npm install --save opentelemetry-instrumentation-agenda
// or
yarn add opentelemetry-instrumentation-agenda
```

## Usage

To load the instrumentation, specify it in the instrumentations list to `registerInstrumentations`. 

```javascript
const { NodeTracerProvider } = require('@opentelemetry/sdk-trace-node');
const { registerInstrumentations } = require('@opentelemetry/instrumentation');
const { AgendaInstrumentation } = require('opentelemetry-instrumentation-agenda');

const provider = new NodeTracerProvider();
provider.register();

registerInstrumentations({
  instrumentations: [
    new AgendaInstrumentation(),
  ],
});
```


