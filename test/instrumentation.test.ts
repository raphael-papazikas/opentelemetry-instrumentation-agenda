import * as assert from 'assert';
import {context, diag, DiagConsoleLogger, DiagLogLevel, propagation} from '@opentelemetry/api';
import { W3CTraceContextPropagator } from '@opentelemetry/core';
import { AsyncHooksContextManager } from '@opentelemetry/context-async-hooks';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import {
  InMemorySpanExporter,
  SimpleSpanProcessor,
} from '@opentelemetry/sdk-trace-base';
import {AgendaInstrumentation} from "../src";

import type {Agenda} from "agenda";

diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG)

describe('agenda', () => {
  const instrumentation = new AgendaInstrumentation();
  const provider = new NodeTracerProvider();
  const memoryExporter = new InMemorySpanExporter();
  const spanProcessor = new SimpleSpanProcessor(memoryExporter);
  provider.addSpanProcessor(spanProcessor);

  const contextManager = new AsyncHooksContextManager();
  context.setGlobalContextManager(contextManager);
  propagation.setGlobalPropagator(new W3CTraceContextPropagator());

  let agendaInstance: Agenda
  beforeEach(async () => {
    contextManager.enable();
    instrumentation.setTracerProvider(provider);
    instrumentation.enable();

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    agendaInstance = new (require("agenda").Agenda)({db: {address: "mongodb://localhost:27017/agenda"}})
    await agendaInstance.start();
  });

  afterEach(() => {
    contextManager.disable();
    contextManager.enable();
    memoryExporter.reset();
    instrumentation.disable();
  });

  describe('job', () => {
    it('should not generate any spans when disabled', async () => {
      instrumentation.disable();
      agendaInstance.define('testJob', {}, () => {
        console.log("run");
      })
      const job = await agendaInstance.now('testJob', {test: 'yes'});
      await job.run()

      const spans = memoryExporter.getFinishedSpans();
      assert.equal(spans.length, 0);
    });

    it('should create a span for job run', async () => {
      instrumentation.enable();
      agendaInstance.define('testJob', {}, () => {
        console.log("run");
      })
      const job = await agendaInstance.now('testJob', {test: 'yes'});
      await job.run()

      const span = memoryExporter.getFinishedSpans()
        .find(span => span.name.startsWith('agenda.job.run'));
      assert.notEqual(span, undefined);
    });

    it("should create a span for job save", async () => {
      instrumentation.enable();
      agendaInstance.define('testJob', {}, () => {
        console.log("run");
      })
      await agendaInstance.now('testJob', {test: 'yes'});

      const span = memoryExporter.getFinishedSpans()
        .find(span => span.name.startsWith('agenda.job.save'));
      assert.notEqual(span, undefined);
    })
  });
});
