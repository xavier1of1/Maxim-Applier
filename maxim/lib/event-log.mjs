import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

import { fromRoot } from "./path-utils.mjs";
import {withLegacyApplicationWrite} from './application-write-gate.mjs';

function nowIso() {
  return new Date().toISOString();
}

function eventFileName(date = new Date()) {
  return `${date.toISOString().slice(0, 10)}.jsonl`;
}

export class EventLog {
  constructor({ eventDir = fromRoot("data", "maxim", "events"), authorityRoot } = {}) {
    this.eventDir = eventDir;
    const parent=path.dirname(path.resolve(eventDir));
    this.authorityRoot=authorityRoot||(path.basename(parent)==='maxim'&&path.basename(path.dirname(parent))==='data'?path.resolve(parent,'../..'):parent);
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

const appendLegacy=EventLog.prototype.append;
EventLog.prototype.append=function(event){
 if(/career.?ops.?evaluation|maxim.?job|application.?record|careerops_synced|application_|evaluation_/i.test((event.entity_type||'')+' '+(event.event_type||''))){
  return withLegacyApplicationWrite(()=>appendLegacy.call(this,event),this.authorityRoot);
 }
 return appendLegacy.call(this,event);
};
