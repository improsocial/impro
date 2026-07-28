import { compose } from "node:stream";
import { spec } from "node:test/reporters";

const THRESHOLD_MS = Number(process.env.SLOW_TEST_MS ?? 500);

// Custom node:test reporter to record slow tests (>500ms by default)
export default async function* testReporter(source) {
  let slowCount = 0;
  const trackSlowTests = async function* () {
    for await (const event of source) {
      if (event.type === "test:pass" || event.type === "test:fail") {
        const { details } = event.data;
        if (details?.type !== "suite" && details?.duration_ms >= THRESHOLD_MS) {
          slowCount++;
        }
      }
      yield event;
    }
    yield {
      type: "test:diagnostic",
      data: { nesting: 0, message: `slow ${slowCount}` },
    };
  };
  yield* compose(trackSlowTests(), spec);
}
