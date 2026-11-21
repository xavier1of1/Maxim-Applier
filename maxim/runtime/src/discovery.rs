use serde_json::{json,Value};
fn terms(value:&Value)->Vec<String>{value.as_array().map(|a|a.iter().filter_map(|v|v.as_str()).map(|s|s.to_lowercase()).filter(|s|!s.is_empty()).collect()).unwrap_or_default()}
fn contains(text:&str,term:&str)->bool{
 text.match_indices(term).any(|(i,_)|{
  let before=text[..i].chars().last();let after=text[i+term.len()..].chars().next();
  before.map(|c|!c.is_alphanumeric()).unwrap_or(true)&&after.map(|c|!c.is_alphanumeric()).unwrap_or(true)
 })
}
pub fn screen(input:&Value)->Value{
 let jobs=match input["jobs"].as_array(){Some(a) if a.len()<=50=>a,_=>return json!({"ok":false,"error":{"code":"discovery_batch_limit"}})};
 let p=&input["profile"];let aliases=terms(&p["titleAliases"]);let excludes=terms(&p["excludedTitles"]);
 let required=p["responsibilityGroupsRequired"].as_u64().unwrap_or(2) as usize;
 let mut decisions=Vec::new();
 for job in jobs{
  let title=job["title"].as_str().unwrap_or("").to_lowercase();let description=job["description"].as_str().unwrap_or("").to_lowercase();
  let groups:Vec<Value>=p["responsibilityGroups"].as_array().into_iter().flatten().filter_map(|g|{
   let hits:Vec<String>=terms(&g["terms"]).into_iter().filter(|s|contains(&description,s)).collect();
   if hits.is_empty(){None}else{Some(json!({"id":g["id"],"terms":hits}))}
  }).collect();
  let target=aliases.iter().any(|a|contains(&title,a));let excluded=excludes.iter().any(|a|contains(&title,a));
  let rescue=groups.len()>=required;let full=job["full"].as_bool().unwrap_or(false);
  let policy=crate::policy::evaluate(&json!({"job":{"description":description,"locationText":job["location"],"locations":job["locations"]}}));
  let location_blocked=policy["flags"].as_array().into_iter().flatten().any(|f|f["flagType"]=="location"&&f["severity"]=="blocker");
  let reason=if excluded{"explicit_title_exclusion"}else if target{"title_alias"}else if rescue{"responsibility_rescue"}else if !full{"uninspected_needs_details"}else{"no_work_evidence"};
  decisions.push(json!({"index":job["index"],"keep":!excluded&&(target||rescue),"explore":!excluded&&!full&&!target&&!rescue&&!location_blocked,"locationBlocked":location_blocked,"reason":reason,"matchedGroups":groups,"kind":"retrieval_rules_not_fit_score"}));
 }
 json!({"ok":true,"decisions":decisions})
}
#[cfg(test)]mod tests{
 use super::*;
 fn run(title:&str,description:&str,full:bool)->Value{screen(&json!({"profile":{"titleAliases":["software engineer"],"excludedTitles":["intern","director"],"responsibilityGroupsRequired":2,"responsibilityGroups":[{"id":"integration","terms":["rest apis","systems integration"]},{"id":"automation","terms":["automate workflows"]}]},"jobs":[{"index":0,"title":title,"description":description,"full":full}]}))["decisions"][0].clone()}
 #[test]fn unexpected_title_survives_on_work(){let r=run("Customer Delivery Builder","Build integrations with REST APIs and automate workflows.",true);assert_eq!(r["keep"],true);assert_eq!(r["reason"],"responsibility_rescue");assert!(r.get("score").is_none());}
 #[test]fn matching_title_is_not_a_claim_of_fit(){assert_eq!(run("Software Engineer","Work requiring ten years.",true)["reason"],"title_alias");}
 #[test]fn exclusions_still_apply_to_rescued_work(){assert_eq!(run("Director","REST APIs; automate workflows.",true)["keep"],false);}
 #[test]fn missing_body_is_not_a_negative_work_decision(){assert_eq!(run("Delivery Builder","",false)["explore"],true);}
 #[test]fn generic_words_do_not_rescue_jobs(){assert_eq!(run("Account Manager","Git and engineer; great customer work.",true)["keep"],false);}
 #[test]fn exclusion_matches_words_not_substrings(){assert_eq!(run("Software Engineer, Internal Tools","",true)["keep"],true);}
}
