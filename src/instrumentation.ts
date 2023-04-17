import {
  InstrumentationBase,
  InstrumentationConfig,
  InstrumentationNodeModuleDefinition,
} from "@opentelemetry/instrumentation"
import type {Span} from "@opentelemetry/api"
import {context, SpanKind, SpanStatusCode, trace} from "@opentelemetry/api"
import type * as agenda from "agenda"

import {VERSION} from "./version";
import {AgendaAttributes} from "./attributes";

export interface AgendaInstrumentationConfig extends InstrumentationConfig {
  /**
   * Prefix for span names
   * @default "agenda"
   */
  prefix?: string
}

const DefaultConfig: AgendaInstrumentationConfig = {
  prefix: "agenda.job",
}

// eslint-disable-next-line @typescript-eslint/ban-types
async function withContext(thisArg: any, original: Function, span: Span, args: unknown[]): Promise<any> {
  const parentContext = context.active()
  const messageContext = trace.setSpan(parentContext, span)

  return await context.with(messageContext, async () => {
    try {
      return await original.apply(thisArg, ...[args])
    } catch (e: any) {
      span.recordException(e)
      span.setStatus({code: SpanStatusCode.ERROR, message: e.message})
      return e
    } finally {
      span.end()
    }
  })
}

function dateStringify(d: Date | null | undefined | number): string | undefined {
  if (d instanceof Date) {
    return d.toISOString()
  }

  return d ? String(d) : undefined
}

export class Instrumentation extends InstrumentationBase {
  _config: AgendaInstrumentationConfig = DefaultConfig

  constructor(inputConfig: AgendaInstrumentationConfig = {}) {
    super("opentelemetry-instrumentation-agenda", VERSION, Object.assign({}, DefaultConfig, inputConfig))
  }

  protected init() {
    return [
      new InstrumentationNodeModuleDefinition<typeof agenda>(
        "agenda/dist/job/index.js",
        ["4.*"],
        this._onPatchJob(),
        this._onUnPatchJob(),
      ),
    ]
  }

  private _onPatchJob() {
    return (moduleExports: typeof agenda) => {
      this._diag.debug("patching job")
      this._wrap(moduleExports.Job.prototype, "run", this._patchJobRun())
      this._wrap(moduleExports.Job.prototype, "save", this._patchJobSave())
      return moduleExports
    }
  }

  private _onUnPatchJob() {
    return (moduleExports: typeof agenda) => {
      this._diag.debug("un-patching job")
      this._unwrap(moduleExports.Job.prototype, "run")
      this._unwrap(moduleExports.Job.prototype, "save")
    }
  }


  private _spanPrefix(action: string): string {
    return `${this._config.prefix}.${action}`
  }

  // eslint-disable-next-line @typescript-eslint/ban-types
  private _patchJobRun(): (original: Function) => (...args: unknown[]) => any {
    const tracer = this.tracer
    const prefix = this._spanPrefix("run");

    return function run(original) {
      return async function patch(this: agenda.Job, ...args: any): Promise<any> {
        const span = tracer.startSpan(`${prefix} ${this.attrs.name}`, {
          attributes: {
            [AgendaAttributes.JOB_ID]: this.attrs._id?.toString(),
            [AgendaAttributes.JOB_NAME]: this.attrs.name,
            [AgendaAttributes.JOB_TYPE]: this.attrs.type,
            [AgendaAttributes.JOB_PRIORITY]: String(this.attrs.priority),
            [AgendaAttributes.JOB_OPTS]: JSON.stringify(this.attrs.data),
            [AgendaAttributes.JOB_REPEAT_INTERVAL]: this.attrs.repeatInterval,
            [AgendaAttributes.JOB_REPEAT_TIMEZONE]: this.attrs.repeatTimezone || undefined,
            [AgendaAttributes.JOB_REPEAT_START_DATE]: dateStringify(this.attrs.startDate),
            [AgendaAttributes.JOB_REPEAT_END_DATE]: dateStringify(this.attrs.endDate),
            [AgendaAttributes.JOB_NEXT_RUN_AT]: dateStringify(this.attrs.nextRunAt),
          },
          kind: SpanKind.INTERNAL,
        })

        return withContext(this, original, span, args)
      }
    }
  }

  // eslint-disable-next-line @typescript-eslint/ban-types
  private _patchJobSave(): (original: Function) => (...args: unknown[]) => any {
    const tracer = this.tracer
    const prefix = this._spanPrefix("save");

    return function save(original) {
      return async function patch(this: agenda.Job, ...args: any[]): Promise<any> {
        const span = tracer.startSpan(`${prefix} ${this.attrs.name}`, {
          attributes: {
            [AgendaAttributes.JOB_ID]: this.attrs._id?.toString(),
            [AgendaAttributes.JOB_NAME]: this.attrs.name,
            [AgendaAttributes.JOB_NAME]: this.attrs.name,
            [AgendaAttributes.JOB_TYPE]: this.attrs.type,
            [AgendaAttributes.JOB_PRIORITY]: String(this.attrs.priority),
            [AgendaAttributes.JOB_OPTS]: JSON.stringify(this.attrs.data),
            [AgendaAttributes.JOB_REPEAT_INTERVAL]: this.attrs.repeatInterval,
            [AgendaAttributes.JOB_REPEAT_TIMEZONE]: this.attrs.repeatTimezone || undefined,
            [AgendaAttributes.JOB_REPEAT_START_DATE]: dateStringify(this.attrs.startDate),
            [AgendaAttributes.JOB_REPEAT_END_DATE]: dateStringify(this.attrs.endDate),
            [AgendaAttributes.JOB_NEXT_RUN_AT]: dateStringify(this.attrs.nextRunAt),
          },
          kind: SpanKind.INTERNAL,
        })


        return withContext(this, original, span, args)
      }
    }
  }
}
