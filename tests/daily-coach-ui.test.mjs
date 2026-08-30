import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

async function read(relativePath) {
  return readFile(new URL(relativePath, import.meta.url), "utf8");
}

test("daily coach exposes a muted-answer crib for python, swift, and iOS study", async () => {
  const component = await read("../app/components/DailyCoach.tsx");
  const app = await read("../app/components/SwiftGhostApp.tsx");
  const styles = await read("../app/globals.css");

  assert.match(component, /Grey answer crib/);
  assert.match(component, /Read the prompt, keep the answer visible/);
  assert.match(component, /aria-label="Crib lane"/);
  assert.match(component, /aria-pressed=\{cribLane === lane\}/);
  assert.match(component, /Focus answer/);
  assert.match(component, /Soft blur/);
  assert.match(component, /onOpenCribItem/);
  assert.match(component, /Start ghost typing/);
  assert.match(component, /Open recall card/);
  assert.match(component, /pythonInterviewScript/);
  assert.match(component, /iosTechnicalScreenScript/);
  assert.match(component, /coachCribLaneLabel/);
  assert.match(component, /coachCribActionLabel/);
  assert.match(component, /coach-crib-answer/);
  assert.match(component, /coach-crib-actions/);
  assert.match(component, /Muted answer sketch/);
  assert.match(component, /coach-plan-answer/);
  assert.match(component, /Focus answer/);
  assert.match(component, /Soft blur/);
  assert.match(component, /is-focused/);
  assert.match(component, /function localPlanningDate\(now = new Date\(\)\)/);
  assert.match(component, /resolveDailyCoachPreferences/);
  assert.match(component, /budgetOverridden/);
  assert.match(component, /coachPreferences\.profile/);
  assert.match(component, /Synced to the \$\{state\.settings\.dailyGoalMinutes\}-minute goal/);
  assert.match(component, /Manual block/);
  assert.match(component, /new Date\(now\.getFullYear\(\), now\.getMonth\(\), now\.getDate\(\), 12\)/);
  assert.match(component, /now\?: number;/);
  assert.match(component, /localPlanningDayKey\(now && now > 0 \? new Date\(now\) : new Date\(\)/);
  assert.match(component, /localPlanningDateFromDayKey\(planningDayKey\)/);
  assert.match(component, /\[ready, planningDayKey\]/);
  assert.match(app, /<DailyCoach[\s\S]*now=\{now\}/);
  assert.match(component, /coach-crib-filters/);
  assert.match(styles, /\.coach-crib\s*\{/);
  assert.match(styles, /\.coach-crib-grid\s*\{/);
  assert.match(styles, /\.coach-crib-actions\s*\{/);
  assert.match(styles, /\.coach-crib-answer\.is-muted/);
  assert.match(styles, /\.coach-crib-answer\.is-focused/);
  assert.match(styles, /\.coach-plan-answer\s*\{/);
  assert.match(styles, /\.coach-plan-answer\.is-muted/);
  assert.match(styles, /\.coach-plan-answer\.is-focused/);
  assert.match(styles, /filter:\s*blur\(1\.8px\);/);
  assert.match(styles, /filter:\s*blur\(1\.4px\);/);
  assert.match(app, /onOpenCribItem=\{\(cribItem\) =>/);
  assert.match(app, /onOpen\(cribItem, 1, undefined, undefined, "typing"\)/);
  assert.match(app, /onOpen\(cribItem, 5, undefined, undefined, "concept"\)/);
});

test("daily coach keeps a local-day planning key stable between ticks and rolls at midnight", async () => {
  const componentUrl = new URL("../app/components/DailyCoach.tsx", import.meta.url).href;
  const script = `
    import assert from "node:assert/strict";
    import { localPlanningDayKey, localPlanningDateFromDayKey } from ${JSON.stringify(componentUrl)};
    const late = new Date(2026, 7, 29, 23, 59, 59, 900);
    const sameDayTick = new Date(2026, 7, 29, 23, 59, 59, 950);
    const nextDay = new Date(2026, 7, 30, 0, 0, 0, 25);
    assert.equal(localPlanningDayKey(late), "2026-08-29");
    assert.equal(localPlanningDayKey(sameDayTick), localPlanningDayKey(late));
    assert.notEqual(localPlanningDayKey(nextDay), localPlanningDayKey(late));
    const planningDate = localPlanningDateFromDayKey(localPlanningDayKey(nextDay));
    assert.equal(planningDate.getFullYear(), 2026);
    assert.equal(planningDate.getMonth(), 7);
    assert.equal(planningDate.getDate(), 30);
    assert.equal(planningDate.getHours(), 12);
  `;
  await execFileAsync(
    process.execPath,
    ["--import", "tsx", "--input-type=module", "-e", script],
    { cwd: new URL("..", import.meta.url) },
  );
});
