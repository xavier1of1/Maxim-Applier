use serde_json::{json, Value};

pub fn question_policy(input: &Value) -> Value {
    let question = match input["question"].as_str() {
        Some(s) if !s.trim().is_empty() && s.len() <= 4000 => s,
        _ => return json!({"ok":false,"error":{"code":"invalid_question"}}),
    };
    let normalized = question
        .to_lowercase()
        .chars()
        .map(|c| {
            if c.is_alphanumeric() || c.is_whitespace() {
                c
            } else {
                ' '
            }
        })
        .collect::<String>()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ");
    let contains = |words: &[&str]| words.iter().any(|w| normalized.contains(w));
    let (kind, sensitivity) = if contains(&[
        "password",
        "api key",
        "access token",
        "social security",
        "ssn",
        "passport number",
        "bank account",
    ]) {
        ("credential", "sensitive")
    } else if contains(&[
        "certify",
        "attest",
        "agree to",
        "consent to",
        "i acknowledge",
        "background check authorization",
    ]) {
        ("attestation", "sensitive")
    } else if contains(&[
        "gender",
        "ethnic",
        "race",
        "veteran",
        "disability",
        "sexual orientation",
        "religion",
        "date of birth",
    ]) {
        ("self_id", "sensitive")
    } else if contains(&["salary", "compensation", "pay expectation", "desired pay"]) {
        ("compensation", "private")
    } else if contains(&[
        "start date",
        "when can you start",
        "availability",
        "notice period",
    ]) {
        ("availability", "private")
    } else if contains(&[
        "previously worked",
        "ever worked",
        "relative",
        "conflict of interest",
        "non compete",
        "noncompete",
    ]) {
        ("employer_relationship", "private")
    } else {
        ("novel", "standard")
    };
    if kind != "novel" {
        return json!({"ok":true,"normalized":normalized,"kind":kind,"sensitivity":sensitivity,"factKey":null,"manualReview":true});
    }
    let mappings: &[(&[&str], &str, &str)] = &[
        (
            &["full name", "what is your full name", "your full name"],
            "candidate.name",
            "standard",
        ),
        (
            &["email", "email address", "what is your email address"],
            "candidate.email",
            "private",
        ),
        (
            &["phone", "phone number", "what is your phone number"],
            "candidate.phone",
            "private",
        ),
        (
            &[
                "current location",
                "where do you currently live",
                "what is your current location",
            ],
            "candidate.location",
            "standard",
        ),
        (
            &["linkedin", "linkedin url", "linkedin profile"],
            "candidate.linkedin",
            "standard",
        ),
        (
            &["github", "github url", "github profile"],
            "candidate.github",
            "standard",
        ),
        (
            &["portfolio", "portfolio url", "personal website"],
            "candidate.portfolio",
            "standard",
        ),
        (
            &[
                "are you a u s citizen",
                "are you a us citizen",
                "u s citizenship",
            ],
            "authorization.us_citizen",
            "private",
        ),
        (
            &[
                "do you require sponsorship",
                "will you require visa sponsorship",
            ],
            "authorization.requires_sponsorship",
            "private",
        ),
        (
            &[
                "do you have an active security clearance",
                "active security clearance",
            ],
            "authorization.active_clearance",
            "private",
        ),
        (
            &["are you eligible to obtain a security clearance"],
            "authorization.eligible_to_obtain_clearance",
            "private",
        ),
        (
            &["are you willing to obtain a security clearance"],
            "authorization.willing_to_obtain_clearance",
            "private",
        ),
    ];
    for (aliases, key, level) in mappings {
        if aliases.contains(&normalized.as_str()) {
            return json!({"ok":true,"normalized":normalized,"kind":"standard_fact","sensitivity":level,"factKey":key,"manualReview":false});
        }
    }
    json!({"ok":true,"normalized":normalized,"kind":kind,"sensitivity":sensitivity,"factKey":null,"manualReview":false})
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn standard_lookup_is_exact() {
        assert_eq!(
            question_policy(&json!({"question":"What is your full name?"}))["factKey"],
            "candidate.name"
        );
    }
    #[test]
    fn unrelated_clearance_is_unknown() {
        assert_eq!(
            question_policy(&json!({"question":"Could you explain clearance policy?"}))["factKey"],
            Value::Null
        );
    }
    #[test]
    fn missing_authorization_is_not_citizenship() {
        assert_eq!(
            question_policy(&json!({"question":"Are you authorized to work in the US?"}))
                ["factKey"],
            Value::Null
        );
    }
    #[test]
    fn private_boolean_stays_private() {
        assert_eq!(
            question_policy(&json!({"question":"Do you require sponsorship?"}))["sensitivity"],
            "private"
        );
    }
    #[test]
    fn specials_require_review() {
        for q in [
            "What salary do you expect?",
            "When can you start?",
            "Have you ever worked here?",
            "I certify my application is accurate",
            "What is your veteran status?",
        ] {
            assert_eq!(
                question_policy(&json!({"question":q}))["manualReview"],
                true
            );
        }
    }
    #[test]
    fn secrets_are_not_answers() {
        assert_eq!(
            question_policy(&json!({"question":"What is your social security number?"}))["kind"],
            "credential"
        );
    }
}
