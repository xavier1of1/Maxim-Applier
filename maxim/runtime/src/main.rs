use serde_json::{json, Value};
use std::io::{self, Read};
mod memory;

fn failure(code: &str) -> Value {
    json!({"ok":false,"error":{"code":code,"message":"The supplied value does not satisfy the candidate data contract."}})
}
fn sensitivity(key: &str) -> &'static str {
    if key.starts_with("self_id.") {
        "sensitive"
    } else if key.starts_with("authorization.")
        || [".email", ".phone", ".address", ".birth_date"]
            .iter()
            .any(|s| key.contains(s))
    {
        "private"
    } else {
        "standard"
    }
}
fn validate_fact(f: &Value) -> Result<Value, &'static str> {
    let key = f["field_key"].as_str().ok_or("invalid_field")?;
    if key.len() > 100
        || !key
            .bytes()
            .all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b"._-".contains(&b))
    {
        return Err("invalid_field");
    }
    let allowed = [
        "candidate.",
        "experience.",
        "education.",
        "projects.",
        "preferences.",
        "authorization.",
        "availability.",
        "compensation.",
        "credentials.",
        "skills.",
        "positioning.",
        "self_id.",
    ];
    if !allowed.iter().any(|p| key.starts_with(p)) || key.ends_with('.') {
        return Err("invalid_field");
    }
    if key
        .split('.')
        .any(|part| ["__proto__", "prototype", "constructor"].contains(&part))
    {
        return Err("invalid_field");
    }
    if ["password", "api_key", "secret", "cookie", "access_token"]
        .iter()
        .any(|s| key.contains(s))
    {
        return Err("credential_forbidden");
    }
    let value = &f["value"];
    let text_ok = |s: &str| {
        !s.trim().is_empty()
            && s.len() <= 8000
            && !s.chars().any(|c| c == '\0')
            && !s.contains("PRIVATE KEY-----")
            && !s
                .split_whitespace()
                .any(|p| (p.starts_with("sk-") || p.starts_with("ghp_")) && p.len() > 24)
    };
    let bool_key = [
        "authorization.us_citizen",
        "authorization.requires_sponsorship",
        "authorization.active_clearance",
        "authorization.eligible_to_obtain_clearance",
        "authorization.willing_to_obtain_clearance",
        "preferences.relocation",
    ];
    if bool_key.contains(&key) && !value.is_boolean() {
        return Err("boolean_required");
    }
    let valid = match value {
        Value::String(s) => text_ok(s),
        Value::Bool(_) => true,
        Value::Number(n) => n
            .as_f64()
            .map(|v| v.is_finite() && v >= 0.0 && v <= 1_000_000_000.0)
            .unwrap_or(false),
        Value::Array(a) => {
            !a.is_empty()
                && a.len() <= 100
                && a.iter().all(|v| v.as_str().map(&text_ok).unwrap_or(false))
        }
        _ => false,
    };
    if !valid {
        return Err("invalid_value");
    }
    Ok(json!({"field_key":key,"value":value,"sensitivity":sensitivity(key)}))
}
pub fn handle(input: &Value) -> Value {
    match input["operation"].as_str() {
        Some("question_policy") => memory::question_policy(input),
        Some("validate_facts") => {
            let facts = match input["facts"].as_array() {
                Some(a) if !a.is_empty() && a.len() <= 50 => a,
                _ => return failure("fact_count"),
            };
            let mut result = Vec::new();
            for f in facts {
                match validate_fact(f) {
                    Ok(v) => result.push(v),
                    Err(c) => return failure(c),
                }
            }
            json!({"ok":true,"facts":result})
        }
        Some("tier") => {
            let score = match input["score"].as_f64() {
                Some(v) if v.is_finite() && (1.0..=5.0).contains(&v) => v,
                _ => return failure("invalid_score"),
            };
            let tier = if score < 3.5 {
                "T0"
            } else if score < 4.0 {
                "T1"
            } else if score < 4.5 {
                "T2"
            } else {
                "T3"
            };
            json!({"ok":true,"score":score,"tier":tier})
        }
        _ => failure("operation_denied"),
    }
}
fn main() {
    let mut bytes = Vec::new();
    let result =
        if io::stdin().take(512001).read_to_end(&mut bytes).is_err() || bytes.len() > 512000 {
            failure("input_limit")
        } else {
            match serde_json::from_slice(&bytes) {
                Ok(v) => handle(&v),
                Err(_) => failure("invalid_json"),
            }
        };
    println!("{}", result);
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn each_tier_boundary() {
        for (s, t) in [
            (1.0, "T0"),
            (3.49, "T0"),
            (3.5, "T1"),
            (3.99, "T1"),
            (4.0, "T2"),
            (4.49, "T2"),
            (4.5, "T3"),
            (5.0, "T3"),
        ] {
            assert_eq!(handle(&json!({"operation":"tier","score":s}))["tier"], t);
        }
    }
    #[test]
    fn invalid_scores_never_become_tiers() {
        for s in [
            Value::Null,
            json!(false),
            json!("4.6"),
            json!(0),
            json!(5.1),
        ] {
            assert_eq!(handle(&json!({"operation":"tier","score":s}))["ok"], false);
        }
    }
    #[test]
    fn missing_booleans_are_not_coerced() {
        assert_eq!(
            handle(
                &json!({"operation":"validate_facts","facts":[{"field_key":"authorization.us_citizen","value":"yes"}]})
            )["ok"],
            false
        );
    }
    #[test]
    fn typed_boolean_is_preserved() {
        assert_eq!(
            handle(
                &json!({"operation":"validate_facts","facts":[{"field_key":"authorization.active_clearance","value":false}]})
            )["facts"][0]["value"],
            false
        );
    }
    #[test]
    fn caller_cannot_downgrade_sensitivity() {
        assert_eq!(
            handle(
                &json!({"operation":"validate_facts","facts":[{"field_key":"candidate.email","value":"synthetic@example.org","sensitivity":"standard"}]})
            )["facts"][0]["sensitivity"],
            "private"
        );
    }
    #[test]
    fn credentials_and_objects_are_refused() {
        for f in [
            json!({"field_key":"candidate.api_key","value":"hidden"}),
            json!({"field_key":"candidate.name","value":{"claim":"invented"}}),
        ] {
            assert_eq!(
                handle(&json!({"operation":"validate_facts","facts":[f]}))["ok"],
                false
            );
        }
    }
    #[test]
    fn text_and_lists_are_supported() {
        assert_eq!(
            handle(
                &json!({"operation":"validate_facts","facts":[{"field_key":"skills.languages","value":["Rust","TypeScript"]}]})
            )["ok"],
            true
        );
    }
    #[test]
    fn field_injection_is_refused() {
        assert_eq!(
            handle(
                &json!({"operation":"validate_facts","facts":[{"field_key":"../private","value":"no"}]})
            )["ok"],
            false
        );
    }
}
