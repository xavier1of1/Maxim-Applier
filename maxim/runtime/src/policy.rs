use regex::Regex;
use serde_json::{json, Value};

fn flag(kind: &str, severity: &str, reason: &str) -> Value {
    json!({"flagType":kind,"severity":severity,"reason":reason})
}
fn matches(pattern: &str, text: &str) -> bool {
    Regex::new(pattern).unwrap().is_match(text)
}
fn amount(value: &Value) -> Option<f64> {
    value
        .as_f64()
        .filter(|v| v.is_finite() && *v > 0.0 && *v <= 1_000_000_000.0)
}

pub fn evaluate(input: &Value) -> Value {
    let job = &input["job"];
    if !job.is_object() {
        return json!({"ok":false,"error":{"code":"invalid_job_policy_input"}});
    }
    let mut flags = Vec::new();
    let raw = job["locations"]
        .as_array()
        .map(|a| a.iter().filter_map(Value::as_str).collect::<Vec<_>>())
        .unwrap_or_else(|| job["locationText"].as_str().into_iter().collect());
    let joined = raw.join(" / ").to_lowercase();
    let nova = matches(
        r"(?i)\b(?:northern\s+(?:virginia|va)|district of columbia|washington\s*,?\s*(?:d\.?\s*c\.?|district of columbia))\b",
        &joined,
    ) || matches(
        r"(?i)\b(?:arlington|alexandria|fairfax|reston|herndon|chantilly|tysons|mclean|ashburn|manassas|gainesville|leesburg|sterling|vienna|falls church|woodbridge|dulles|centreville|bristow|lorton)\s*,?\s*(?:va|virginia)\b",
        &joined,
    );
    let negated = matches(
        r"(?i)\b(?:except|excluding|not in|not available in)\b",
        &joined,
    );
    let maryland = matches(r"(?i)\b(?:maryland|bethesda|rockville)\b|,\s*md\b", &joined);
    let override_md = input["allowMaryland"].as_bool() == Some(true)
        && input["overrideReason"]
            .as_str()
            .map(|s| s.trim().len() >= 3)
            .unwrap_or(false);
    if nova && !negated {
        flags.push(flag(
            "location",
            "positive",
            "At least one verified NoVA/DC location is compatible.",
        ));
    } else if maryland && override_md {
        flags.push(flag(
            "location_override",
            "positive",
            "Maryland was explicitly included for this query with a recorded reason.",
        ));
    } else if maryland {
        flags.push(flag(
            "location",
            "blocker",
            "Maryland-only roles are excluded without an explicit manual override.",
        ));
    } else if joined.is_empty()
        || negated
        || matches(r"(?i)\b(?:remote|united states|usa|virginia)\b", &joined)
            && !matches(
                r"(?i)\b(?:richmond|norfolk|roanoke|virginia beach)\b",
                &joined,
            )
    {
        flags.push(flag("location","review","Location is missing, broad, remote or ambiguous; NoVA/DC compatibility is not established."));
    } else if matches(
        r"(?i),\s*(?:al|ak|az|ar|ca|co|ct|de|fl|ga|hi|id|il|in|ia|ks|ky|la|me|ma|mi|mn|ms|mo|mt|ne|nv|nh|nj|nm|ny|nc|nd|oh|ok|or|pa|ri|sc|sd|tn|tx|ut|vt|wa|wv|wi|wy)\b|\b(?:florida|texas|egypt|canada|ireland|united kingdom|california|richmond|norfolk|roanoke)\b",
        &joined,
    ) {
        flags.push(flag(
            "location",
            "blocker",
            "Known location is outside the confirmed NoVA/DC policy.",
        ));
    } else {
        flags.push(flag(
            "location",
            "review",
            "City/state is not verified as NoVA/DC; same-named cities require review.",
        ));
    }

    let salary = &job["salary"];
    let flat = amount(&salary["flat"]);
    let min = amount(&salary["min"]);
    let max = amount(&salary["max"]);
    let currency = salary["currency"].as_str().unwrap_or("USD").to_uppercase();
    let period = salary["period"].as_str().unwrap_or("year").to_lowercase();
    let annual = ["year", "annual", "annually", "1 year"].contains(&period.as_str());
    let tier = input["tier"].as_str().unwrap_or("");
    if !["", "T0", "T1", "T2", "T3"].contains(&tier) {
        return json!({"ok":false,"error":{"code":"invalid_tier"}});
    }
    let floor = if tier == "T3" { 90000.0 } else { 85000.0 };
    let mut numeric = None;
    let mut expected_review = true;
    if flat.is_none() && min.is_none() && max.is_none() {
        flags.push(flag(
            "salary",
            "review",
            "Annual salary is unknown; no amount or interval is inferred.",
        ));
    } else if currency != "USD" || !annual {
        flags.push(flag(
            "salary",
            "review",
            "Currency or pay interval is not confirmed as annual USD.",
        ));
    } else if flat.map(|v| v > 10_000_000.0).unwrap_or(false)
        || max.map(|v| v > 10_000_000.0).unwrap_or(false)
    {
        flags.push(flag(
            "salary",
            "review",
            "Unusually large salary needs source verification.",
        ));
    } else if flat.is_some() && (min.is_some() || max.is_some()) {
        flags.push(flag(
            "salary",
            "review",
            "Conflicting flat and range compensation requires explicit review.",
        ));
    } else if let Some(v) = flat {
        flags.push(flag(
            "salary",
            if v < floor { "blocker" } else { "positive" },
            if v < floor {
                "Flat annual USD salary is below the confirmed minimum."
            } else {
                "Flat annual USD salary satisfies the confirmed minimum."
            },
        ));
        numeric = Some(v.max(100000.0).round());
        expected_review = numeric.unwrap() > v;
    } else if let (Some(lo), Some(hi)) = (min, max) {
        if lo > hi {
            flags.push(flag(
                "salary",
                "review",
                "Posted salary bounds are reversed or invalid.",
            ));
        } else {
            let supported =
                lo >= 80000.0 && hi >= 95000.0 && (lo >= 90000.0 || hi - 90000.0 >= 5000.0);
            flags.push(flag(
                "salary",
                if hi < 85000.0 {
                    "blocker"
                } else if supported {
                    "positive"
                } else {
                    "review"
                },
                if hi < 85000.0 {
                    "Range maximum is below the global minimum."
                } else if supported {
                    "Annual USD range supports target compensation."
                } else {
                    "Salary range needs explicit compensation review."
                },
            ));
            let median = ((lo + hi) / 2.0).round().max(100000.0);
            numeric = Some(if tier == "T3" && lo <= 110000.0 && hi >= 110000.0 {
                110000.0
            } else {
                median
            });
            expected_review = numeric.unwrap() < lo || numeric.unwrap() > hi;
        }
    } else {
        flags.push(flag(
            "salary",
            "review",
            "Incomplete salary bounds require review; no median is invented.",
        ));
    }

    let description = format!(
        "{} {}",
        job["clearanceText"].as_str().unwrap_or(""),
        job["description"].as_str().unwrap_or("")
    );
    if description.len() > 100_000 {
        return json!({"ok":false,"error":{"code":"policy_text_limit"}});
    }
    let mut active_required = false;
    let mut clearance_present = false;
    // Compile once per posting, not once per sentence in long public-board descriptions.
    let clearance_pattern = Regex::new(r"(?i)\b(?:clearance|ts/sci|ts sci|top secret)\b").unwrap();
    let active_pattern = Regex::new(r"(?i)\b(?:active|current|possess|hold|maintain)\b").unwrap();
    let required_pattern = Regex::new(r"(?i)\b(?:required|requires|must|possess|hold|maintain)\b").unwrap();
    let not_required_pattern = Regex::new(
        r"(?i)\bno active (?:security )?clearance (?:is )?required\b|\bactive (?:security )?clearance (?:is )?not required\b|\bnot required to (?:hold|possess)\b",
    ).unwrap();
    for sentence in description.split(&['.', ';', '\n'][..]) {
        let clearance = clearance_pattern.is_match(sentence);
        clearance_present |= clearance;
        let active = active_pattern.is_match(sentence);
        let required = required_pattern.is_match(sentence);
        let explicitly_not_required = not_required_pattern.is_match(sentence);
        if clearance && active && required && !explicitly_not_required {
            active_required = true;
        }
    }
    if active_required {
        flags.push(flag(
            "clearance",
            "blocker",
            "Active/current clearance is required; never claim an active clearance.",
        ));
    } else if clearance_present {
        flags.push(flag("clearance","review","Clearance language needs review; eligibility/willingness does not mean active clearance."));
    }
    if matches(
        r"(?i)\b(?:upfront fee|pay to apply|application deposit)\b",
        &description,
    ) {
        flags.push(flag(
            "caution",
            "review",
            "Posting contains payment language requiring manual legitimacy review.",
        ));
    }
    let age = job["postedAgeHours"].as_f64().filter(|v| v.is_finite());
    let fresh = age.map(|v| (0.0..=48.0).contains(&v)).unwrap_or(false);
    if age.map(|v| v < 0.0).unwrap_or(false) {
        flags.push(flag(
            "freshness",
            "review",
            "Posted timestamp is in the future and cannot justify urgency.",
        ));
    } else if age.is_none() {
        flags.push(flag(
            "freshness",
            "info",
            "Posted time is unknown; first seen is not a substitute.",
        ));
    } else if fresh {
        flags.push(flag(
            "freshness",
            "positive",
            "Known posted time is within 48 hours.",
        ));
    }
    let blocked = flags.iter().any(|f| f["severity"] == "blocker");
    let review = flags.iter().any(|f| f["severity"] == "review");
    let urgent = fresh && ["T2", "T3"].contains(&tier) && !blocked && !review;
    if urgent {
        flags.push(flag(
            "fresh",
            "urgent",
            "Fresh eligible T2+ role merits immediate attention.",
        ));
    }
    let connections = input["prioritySignals"]
        .as_array()
        .map(|a| {
            a.iter().any(|v| {
                [
                    "connection",
                    "vt_alumni",
                    "recruiter",
                    "founder",
                    "target_company",
                ]
                .contains(&v.as_str().unwrap_or(""))
            })
        })
        .unwrap_or(false);
    if connections {
        flags.push(flag("connection_overlay","positive","Verified connection/target-company signal adds priority only; it never changes score, tier or policy."));
    }
    json!({"ok":true,"policyVersion":"xavier-annual-usd-nova-dc-v1","allowed":!blocked,"reviewRequired":review,
        "eligibility":if blocked {"blocked"} else if review {"review"} else {"eligible"},
        "urgent":urgent,"flags":flags,"expectedSalary":{"numeric":numeric,"requiresReview":expected_review,
        "text":"Negotiable based on role scope and total compensation.","basis":"Posted annual USD median with 100k default floor; supported T3 range permits 110k."}})
}

#[cfg(test)]
mod tests {
    use super::*;
    fn job(location: &str) -> Value {
        json!({"operation":"job_policy","job":{"locations":[location],"salary":{"flat":100000},"title":"Software Engineer"}})
    }
    fn has(value: &Value, kind: &str, severity: &str) -> bool {
        value["flags"]
            .as_array()
            .unwrap()
            .iter()
            .any(|f| f["flagType"] == kind && f["severity"] == severity)
    }
    #[test]
    fn nova_and_dc() {
        for l in [
            "Arlington, VA",
            "Washington, DC",
            "Gainesville, VA",
            "Manassas, VA",
        ] {
            assert!(has(&evaluate(&job(l)), "location", "positive"), "{}", l);
        }
    }
    #[test]
    fn same_named_cities_not_nova() {
        for l in ["Gainesville, FL", "Arlington, TX", "Alexandria, Egypt"] {
            assert_eq!(evaluate(&job(l))["eligibility"], "blocked");
        }
        assert!(has(&evaluate(&job("Gainesville")), "location", "review"));
    }
    #[test]
    fn maryland_and_multiple() {
        assert_eq!(evaluate(&job("Bethesda, MD"))["allowed"], false);
        let mut j = job("Bethesda, MD");
        j["job"]["locations"] = json!(["Bethesda, MD", "Reston, VA"]);
        assert_eq!(evaluate(&j)["eligibility"], "eligible");
        j["job"]["locations"] = json!(["Bethesda, MD"]);
        j["allowMaryland"] = json!(true);
        assert_eq!(evaluate(&j)["allowed"], false);
        j["overrideReason"] = json!("Explicit test exception");
        assert_eq!(evaluate(&j)["allowed"], true);
    }
    #[test]
    fn flat_salary_boundaries() {
        for (tier, salary, expected) in [
            ("T2", 84000, false),
            ("T2", 85000, true),
            ("T3", 89000, false),
            ("T3", 90000, true),
        ] {
            let mut j = job("Reston, VA");
            j["tier"] = json!(tier);
            j["job"]["salary"]["flat"] = json!(salary);
            assert_eq!(evaluate(&j)["allowed"], expected);
        }
    }
    #[test]
    fn salary_ranges() {
        for (lo, hi, positive) in [
            (80000, 95000, true),
            (95000, 125000, true),
            (75000, 150000, false),
            (90000, 85000, false),
        ] {
            let mut j = job("Reston, VA");
            j["job"]["salary"] = json!({"min":lo,"max":hi});
            assert_eq!(has(&evaluate(&j), "salary", "positive"), positive);
        }
    }
    #[test]
    fn currency_period_and_invalid_numbers() {
        for s in [
            json!({"flat":100000,"currency":"CAD"}),
            json!({"flat":100000,"period":"month"}),
            json!({"min":true,"max":"Infinity"}),
        ] {
            let mut j = job("Reston, VA");
            j["job"]["salary"] = s;
            assert!(has(&evaluate(&j), "salary", "review"));
        }
    }
    #[test]
    fn active_clearance_not_suppressed_elsewhere() {
        let mut j = job("Reston, VA");
        j["job"]["description"] = json!(
            "Active TS/SCI clearance required. Eligible candidates may obtain other training."
        );
        assert_eq!(evaluate(&j)["allowed"], false);
        j["job"]["description"] =
            json!("Eligible to obtain a security clearance. No active clearance required.");
        assert_eq!(evaluate(&j)["allowed"], true);
    }
    #[test]
    fn salary_answers() {
        let mut j = job("Reston, VA");
        j["job"]["salary"] = json!({"min":90000,"max":120000});
        j["tier"] = json!("T2");
        assert_eq!(evaluate(&j)["expectedSalary"]["numeric"], 105000.0);
        j["tier"] = json!("T3");
        assert_eq!(evaluate(&j)["expectedSalary"]["numeric"], 110000.0);
        j["job"]["salary"] = json!({"min":150000,"max":200000});
        assert_eq!(evaluate(&j)["expectedSalary"]["numeric"], 175000.0);
    }
    #[test]
    fn freshness_and_connection_overlay() {
        let mut j = job("Reston, VA");
        j["tier"] = json!("T2");
        j["job"]["postedAgeHours"] = json!(12);
        assert_eq!(evaluate(&j)["urgent"], true);
        j["job"]["postedAgeHours"] = json!(-1);
        assert_eq!(evaluate(&j)["urgent"], false);
        j["prioritySignals"] = json!(["vt_alumni"]);
        j["job"]["locations"] = json!(["Arlington, TX"]);
        assert_eq!(evaluate(&j)["allowed"], false);
    }
}
