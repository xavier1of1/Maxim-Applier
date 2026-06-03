import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

import { fromRoot } from "./path-utils.mjs";

function nowIso() {
  return new Date().toISOString();
}

function eventFileName(date = new Date()) {
  return `${date.toISOString().slice(0, 10)}.jsonl`;
}

export class EventLog {
  constructor({ eventDir = fromRoot("data", "maxim", "events") } = {}) {
    this.eventDir = eventDir;
  }

  append(event) {
    fs.mkdirSync(this.eventDir, { recursive: true });
    const record = {
      event_id: event.event_id ?? crypto.randomUUID(),
      event_type: event.event_type,
      entity_type: event.entity_type ?? "unknown",
      entity_id: event.entity_id ?? "unknown",
      timestamp: event.timestamp ?? nowIso(),
      actor: event.actor ?? "system",
      reason: event.reason ?? "",
      payload: event.payload ?? {},
    };
    const target = path.join(this.eventDir, eventFileName(new Date(record.timestamp)));
    fs.appendFileSync(target, `${JSON.stringify(record)}\n`, "utf8");
    return record;
  }

  readAll() {
    if (!fs.existsSync(this.eventDir)) {
      return [];
    }
    return fs
      .readdirSync(this.eventDir)
      .filter((name) => name.endsWith(".jsonl"))
      .sort()
      .flatMap((name) => {
        const text = fs.readFileSync(path.join(this.eventDir, name), "utf8");
        return text
          .split(/\r?\n/)
          .filter(Boolean)
          .map((line) => JSON.parse(line));
      });
  }
}

export function appendEvent(event, options) {
  return new EventLog(options).append(event);
}
