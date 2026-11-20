use serde_json::{json,Value};
use std::collections::{HashMap,HashSet};

fn strings(v:&Value)->Vec<String>{v.as_array().map(|a|a.iter().filter_map(|s|s.as_str().map(|s|s.to_lowercase())).collect()).unwrap_or_default()}
pub fn lane(title:&str)->&'static str {
 let t=title.to_lowercase();
 if t.contains("forward deployed")||t.contains("deployment strategist"){"Forward deployed"}
 else if t.contains("full stack")||t.contains("full-stack"){"Full stack"}
 else if t.contains("front end")||t.contains("frontend"){"Frontend"}
 else if t.contains("back end")||t.contains("backend"){"Backend"}
 else if t.contains("data engineer"){"Data engineering"}
 else if t.contains("automation")||t.contains("test engineer"){"Automation"}
 else if t.contains("systems")||t.contains("platform")||t.contains("devops"){"Systems / platform"}
 else if t.contains("software")||t.contains("developer")||t.contains("engineer"){"Software engineering"}
 else {"Other roles"}
}
pub fn metadata(input:&Value)->Value{
 let title=input["title"].as_str().unwrap_or("");let text=input["description"].as_str().unwrap_or("");
 let mut out=String::new();let mut in_section=false;
 for line in text.lines().take(1500){
  let line=line.trim();let lower=line.to_lowercase();
  if ["qualification","requirement","what you bring","what we look for","must have"].iter().any(|s|lower.contains(s)){in_section=true;}
  if in_section&&!out.is_empty()&&["benefits","compensation","about us","equal opportunity"].iter().any(|s|lower.starts_with(s)){break;}
  if in_section&&!line.is_empty(){if out.chars().count()+line.chars().count()>4000{break;}out.push_str(line);out.push('\n');}
 }
 json!({"ok":true,"lane":lane(title),"qualifications":out})
}
pub fn shortlist(input:&Value)->Value{
 let jobs=match input["jobs"].as_array(){Some(j) if j.len()<=200=>j,_=>return json!({"ok":false,"error":{"code":"pool_limit","message":"At most 200 posting summaries may be screened."}})};
 let p=&input["policy"];let limit=p["evaluationsPerCycle"].as_u64().unwrap_or(5).min(20) as usize;
 let max_age=p["maxAgeDays"].as_f64().unwrap_or(7.0)*24.0;
 let evidence:Vec<String>=strings(&input["evidenceTerms"]).into_iter().filter(|s|s.len()>=3).take(80).collect();
 let terms=strings(&input["targetTerms"]);let excluded=strings(&p["excludedTitleTerms"]);
 let mut eligible=Vec::new();let mut held=Vec::new();
 for job in jobs {
  let id=job["id"].as_str().unwrap_or("");let title=job["title"].as_str().unwrap_or("").to_lowercase();
  let text=format!("{} {}",title,job["description"].as_str().unwrap_or("").to_lowercase());
  let age=job["ageHours"].as_f64();let hits:Vec<_>=evidence.iter().filter(|s|text.contains(s.as_str())).cloned().collect();
  let reason=if job["blocked"].as_bool().unwrap_or(true){Some("policy_blocked_or_unreviewed_location")}
   else if job["hasEvaluation"].as_bool().unwrap_or(false){Some("already_evaluated_or_pending")}
   else if job["description"].as_str().unwrap_or("").trim().len()<50{Some("full_posting_required")}
   else if age.is_none()&&!p["allowUnknownDates"].as_bool().unwrap_or(false){Some("posted_date_unknown")}
   else if age.map(|v|v<0.0||v>max_age).unwrap_or(false){Some("outside_freshness_window")}
   else if excluded.iter().any(|s|title.contains(s)){Some("excluded_title")}
   else if hits.len()<p["minEvidenceMatches"].as_u64().unwrap_or(1) as usize{Some("insufficient_approved_evidence_overlap")}
   else {None};
  if let Some(reason)=reason{held.push(json!({"id":id,"reason":reason}));continue;}
  let target=terms.iter().any(|s|title.contains(s));let priority=job["priority"].as_bool().unwrap_or(false);
  eligible.push((id.to_string(),job["company"].as_str().unwrap_or("").to_lowercase(),age.unwrap_or(f64::MAX),target,priority,hits));
 }
 eligible.sort_by(|a,b|b.4.cmp(&a.4).then(b.3.cmp(&a.3)).then(a.2.total_cmp(&b.2)).then(a.0.cmp(&b.0)));
 let mut selected=Vec::new();let mut used=HashSet::new();let mut companies:HashMap<String,usize>=HashMap::new();
 // Round-robin employers before taking another opening from the same company.
 for quota in 1..=limit {
  for (id,company,age,target,priority,hits) in &eligible {
   if selected.len()>=limit{break;}
   if used.contains(id)||companies.get(company).copied().unwrap_or(0)>=quota{continue;}
   used.insert(id.clone());*companies.entry(company.clone()).or_default()+=1;
   selected.push(json!({"id":id,"lane":lane(jobs.iter().find(|j|j["id"]==*id).and_then(|j|j["title"].as_str()).unwrap_or("")),"evidenceTerms":hits,"reasons":{"targetRole":target,"priorityOverlay":priority,"fresh24h":age<=&24.0}}));
  }
 }
 if limit>=5 && selected.len()>=5 {
  if let Some((id,_,_,_,_,hits))=eligible.iter().find(|(id,_,_,target,_,_)|!used.contains(id)&&!*target){
   selected.pop();selected.push(json!({"id":id,"evidenceTerms":hits,"reasons":{"exploration":true}}));
  }
 }
 json!({"ok":true,"selected":selected,"held":held,"eligible":eligible.len(),"kind":"queue_priority_not_fit_score"})
}
#[cfg(test)]mod tests{
 use super::*;
 fn job(id:&str,company:&str)->Value{json!({"id":id,"company":company,"title":"Full Stack Engineer","description":"Build reliable customer integrations in Rust and TypeScript with a small delivery team.","ageHours":2,"blocked":false})}
 #[test]fn selection_is_not_a_fit_score_and_is_diverse(){let r=shortlist(&json!({"jobs":[job("1","A"),job("2","A"),job("3","B")],"evidenceTerms":["Rust"],"policy":{"evaluationsPerCycle":2}}));assert_eq!(r["selected"][1]["id"],"3");assert!(r["selected"][0].get("score").is_none());}
 #[test]fn no_approved_evidence_means_no_automatic_evaluations(){assert_eq!(shortlist(&json!({"jobs":[job("1","A")]}))["selected"].as_array().unwrap().len(),0);}
 #[test]fn unknown_blocked_old_and_evaluated_stay_held(){for (key,value) in [("blocked",json!(true)),("ageHours",json!(null)),("ageHours",json!(1000)),("hasEvaluation",json!(true))]{let mut j=job("x","A");j[key]=value;assert_eq!(shortlist(&json!({"jobs":[j],"evidenceTerms":["Rust"]}))["selected"].as_array().unwrap().len(),0);}}
 #[test]fn qualification_text_is_not_invented(){let m=metadata(&json!({"title":"Forward Deployed Engineer","description":"About us\nRequirements\nRust experience\nBenefits\nFree food"}));assert_eq!(m["lane"],"Forward deployed");assert_eq!(m["qualifications"],"Requirements\nRust experience\n");}
 #[test]fn absent_qualifications_remain_unknown(){assert_eq!(metadata(&json!({"description":"We build software"}))["qualifications"],"");}
}
