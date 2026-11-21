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
  if in_section&&!line.is_empty(){let remaining=4000usize.saturating_sub(out.chars().count());if remaining==0{break;}out.extend(line.chars().take(remaining));if out.chars().count()<4000{out.push('\n');}}
 }
 json!({"ok":true,"lane":lane(title),"qualifications":out})
}
pub fn shortlist(input:&Value)->Value{
 let jobs=match input["jobs"].as_array(){Some(j) if j.len()<=200=>j,_=>return json!({"ok":false,"error":{"code":"pool_limit","message":"At most 200 posting summaries may be screened."}})};
 let p=&input["policy"];let limit=p["evaluationsPerCycle"].as_u64().unwrap_or(5).min(20) as usize;
 let max_age=p["maxAgeDays"].as_f64().unwrap_or(7.0)*24.0;
 let all_scanned=p["scoringScope"].as_str()==Some("all_scanned");
 let evidence:Vec<String>=strings(&input["evidenceTerms"]).into_iter().filter(|s|s.len()>=3).take(80).collect();
 let terms=strings(&input["targetTerms"]);let excluded=strings(&p["excludedTitleTerms"]);
 let mut eligible=Vec::new();let mut held=Vec::new();
 for job in jobs {
  let id=job["id"].as_str().unwrap_or("");let title=job["title"].as_str().unwrap_or("").to_lowercase();
  let text=format!("{} {}",title,job["description"].as_str().unwrap_or("").to_lowercase());
  let age=job["ageHours"].as_f64();let hits:Vec<_>=evidence.iter().filter(|s|text.contains(s.as_str())).cloned().collect();
  let reason=if let Some(hold)=job["holdReason"].as_str(){Some(hold)}
   else if !all_scanned&&job["blocked"].as_bool().unwrap_or(true){Some("policy_blocked_or_unreviewed_location")}
   else if job["hasEvaluation"].as_bool().unwrap_or(false){Some("already_evaluated_or_pending")}
   else if job["fullPosting"].as_bool()==Some(false)||job["description"].as_str().unwrap_or("").trim().len()<50{Some("full_posting_required")}
   else if !all_scanned&&age.is_none()&&!p["allowUnknownDates"].as_bool().unwrap_or(false){Some("posted_date_unknown")}
   else if !all_scanned&&age.map(|v|v<0.0||v>max_age).unwrap_or(false){Some("outside_freshness_window")}
   else if !all_scanned&&excluded.iter().any(|s|title.contains(s)){Some("excluded_title")}
   else if !all_scanned&&hits.len()<p["minEvidenceMatches"].as_u64().unwrap_or(1) as usize{Some("insufficient_approved_evidence_overlap")}
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
 let offset=input["explorationOffset"].as_u64().unwrap_or(0) as usize;
 for index in 0..selected.len(){
  if (offset+index+1)%5!=0 {continue;}
  if let Some((id,_,_,_,_,hits))=eligible.iter().find(|(id,_,_,target,_,_)|!used.contains(id)&&!*target){
   let old=selected[index]["id"].as_str().unwrap_or("").to_string();used.remove(&old);used.insert(id.clone());
   selected[index]=json!({"id":id,"evidenceTerms":hits,"reasons":{"exploration":true}});
  }
 }
 json!({"ok":true,"selected":selected,"held":held,"eligible":eligible.len(),"kind":"queue_priority_not_fit_score"})
}
pub fn flow(input:&Value)->Value{
 use std::collections::BTreeMap;
 let mut links:BTreeMap<(String,String),u64>=BTreeMap::new();let mut names=HashSet::new();let mut total=0;
 if let Some(groups)=input["groups"].as_array(){for group in groups.iter().take(512){
  let count=group["count"].as_u64().unwrap_or(0);if count==0{continue;}total+=count;
  let mut path=vec!["Submitted"];
  if group["responded"].as_bool().unwrap_or(false){path.push("Response recorded");}
  if group["interviewed"].as_bool().unwrap_or(false){path.push("Interview recorded");}
  if group["offered"].as_bool().unwrap_or(false){path.push("Offer recorded");}
  path.push(match group["outcome"].as_str().unwrap_or("unknown"){
   "submitted"=>"Awaiting response","responded"=>"In discussion","interviewing"=>"Interview active",
   "offer"=>"Offer active","rejected"=>"Rejected","withdrawn"=>"Withdrawn",_=>"Outcome unknown"});
  for pair in path.windows(2){let a=pair[0].to_string();let b=pair[1].to_string();names.insert(a.clone());names.insert(b.clone());*links.entry((a,b)).or_default()+=count;}
 }}
 let colors=[("Submitted","#287c9e"),("Response recorded","#32775c"),("Interview recorded","#9161a8"),("Offer recorded","#bd8520"),("Awaiting response","#728b98"),("In discussion","#24928d"),("Interview active","#6b64bd"),("Offer active","#68a84b"),("Rejected","#cc6868"),("Withdrawn","#ac7a58"),("Outcome unknown","#8b9297")];
 json!({"ok":true,"total":total,"nodes":colors.iter().filter(|(name,_)|names.contains(*name)).map(|(name,color)|json!({"id":name,"label":name,"color":color})).collect::<Vec<_>>(),"links":links.iter().map(|((source,target),value)|json!({"source":source,"target":target,"value":value})).collect::<Vec<_>>()})
}
#[cfg(test)]mod tests{
 use super::*;
 fn job(id:&str,company:&str)->Value{json!({"id":id,"company":company,"title":"Full Stack Engineer","description":"Build reliable customer integrations in Rust and TypeScript with a small delivery team.","ageHours":2,"blocked":false})}
 #[test]fn selection_is_not_a_fit_score_and_is_diverse(){let r=shortlist(&json!({"jobs":[job("1","A"),job("2","A"),job("3","B")],"evidenceTerms":["Rust"],"policy":{"evaluationsPerCycle":2}}));assert_eq!(r["selected"][1]["id"],"3");assert!(r["selected"][0].get("score").is_none());}
 #[test]fn no_approved_evidence_means_no_automatic_evaluations(){assert_eq!(shortlist(&json!({"jobs":[job("1","A")]}))["selected"].as_array().unwrap().len(),0);}
 #[test]fn all_scanned_evaluates_without_shortlist_preferences(){let mut j=job("x","A");j["title"]=json!("Principal Intern");j["blocked"]=json!(true);j["ageHours"]=Value::Null;let r=shortlist(&json!({"jobs":[j],"policy":{"scoringScope":"all_scanned","excludedTitleTerms":["intern"]}}));assert_eq!(r["selected"].as_array().unwrap().len(),1);assert!(r["selected"][0].get("score").is_none());}
 #[test]fn all_scanned_keeps_pending_missing_and_explicit_holds(){for (key,value) in [("hasEvaluation",json!(true)),("description",json!("short")),("holdReason",json!("disclosure_review_required"))]{let mut j=job("x","A");j[key]=value;assert_eq!(shortlist(&json!({"jobs":[j],"policy":{"scoringScope":"all_scanned"}}))["selected"].as_array().unwrap().len(),0);}}
 #[test]fn unknown_blocked_old_and_evaluated_stay_held(){for (key,value) in [("blocked",json!(true)),("ageHours",json!(null)),("ageHours",json!(1000)),("hasEvaluation",json!(true))]{let mut j=job("x","A");j[key]=value;assert_eq!(shortlist(&json!({"jobs":[j],"evidenceTerms":["Rust"]}))["selected"].as_array().unwrap().len(),0);}}
 #[test]fn qualification_text_is_not_invented(){let m=metadata(&json!({"title":"Forward Deployed Engineer","description":"About us\nRequirements\nRust experience\nBenefits\nFree food"}));assert_eq!(m["lane"],"Forward deployed");assert_eq!(m["qualifications"],"Requirements\nRust experience\n");}
 #[test]fn absent_qualifications_remain_unknown(){assert_eq!(metadata(&json!({"description":"We build software"}))["qualifications"],"");}
 #[test]fn long_qualification_paragraph_retains_bounded_source_text(){let r=metadata(&json!({"description":format!("Qualifications\nRust {}", "工程".repeat(5000))}));let q=r["qualifications"].as_str().unwrap();assert_eq!(q.chars().count(),4000);assert!(q.contains("Rust"));}
 #[test]fn exploration_spans_small_batches(){let mut other=job("3","C");other["title"]=json!("Platform Engineer");let r=shortlist(&json!({"jobs":[job("1","A"),job("2","B"),other],"evidenceTerms":["Rust"],"targetTerms":["Full Stack"],"explorationOffset":3,"policy":{"evaluationsPerCycle":2}}));assert_eq!(r["selected"][1]["id"],"3");}
 #[test]fn flow_conserves_submissions_without_inventing_missing_stages(){let r=flow(&json!({"groups":[{"count":3,"outcome":"submitted"},{"count":2,"interviewed":true,"outcome":"rejected"}]}));assert_eq!(r["total"],5);assert!(!r["nodes"].as_array().unwrap().iter().any(|n|n["id"]=="Response recorded"));let root:u64=r["links"].as_array().unwrap().iter().filter(|l|l["source"]=="Submitted").map(|l|l["value"].as_u64().unwrap()).sum();assert_eq!(root,5);}
 #[test]fn empty_flow_has_no_fixture_nodes(){assert_eq!(flow(&json!({"groups":[]}))["nodes"],json!([]));}
}
