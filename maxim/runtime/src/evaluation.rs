use regex::Regex;
use serde_json::{json,Value};
fn fail(code:&str)->Value{json!({"ok":false,"error":{"code":code,"message":"Career-Ops report requires review; no score or tier was inferred."}})}
fn normalized(text:&str)->String{text.split_whitespace().collect::<Vec<_>>().join(" ").to_lowercase()}
pub fn parse(input:&Value)->Value{
 let report=match input["report"].as_str(){Some(v) if !v.is_empty()&&v.len()<=240000=>v,_=>return fail("report_size")};
 let blocks=Regex::new(r"(?s)---SCORE_SUMMARY---\s*(.*?)\s*---END_SUMMARY---").unwrap().captures_iter(report).collect::<Vec<_>>();
 if blocks.len()!=1{return fail("summary_count");}
 let summary=&blocks[0][1];
 let field=|key:&str|->Option<String>{
  let values=summary.lines().filter_map(|l|l.trim().strip_prefix(&format!("{}:",key)).map(|v|v.trim().to_string())).collect::<Vec<_>>();
  if values.len()==1&&!values[0].is_empty(){Some(values[0].clone())}else{None}
 };
 let score_text=match field("SCORE"){Some(v)=>v,None=>return fail("missing_score")};
 if !Regex::new(r"^(?:[1-4](?:\.\d+)?|5(?:\.0+)?)$").unwrap().is_match(&score_text){return fail("invalid_score");}
 let score=match score_text.parse::<f64>(){Ok(v) if v.is_finite()&&(1.0..=5.0).contains(&v)=>v,_=>return fail("invalid_score")};
 let company=match field("COMPANY"){Some(v)=>v,None=>return fail("missing_company")};
 let role=match field("ROLE"){Some(v)=>v,None=>return fail("missing_role")};
 if normalized(&company)!=normalized(input["company"].as_str().unwrap_or(""))||normalized(&role)!=normalized(input["title"].as_str().unwrap_or("")){return fail("report_identity_mismatch");}
 let archetype=match field("ARCHETYPE"){Some(v)=>v,None=>return fail("missing_archetype")};
 let legitimacy=match field("LEGITIMACY"){Some(v) if ["High Confidence","Proceed with Caution","Suspicious"].contains(&v.as_str())=>v,_=>return fail("invalid_legitimacy")};
 let headings=Regex::new(r"(?m)^#{1,6}\s*(?:Block\s+)?([A-H])(?:[.):]|\s*[-–—])\s*(.+)$").unwrap();
 let found=headings.captures_iter(report).map(|c|c[1].to_string()).collect::<Vec<_>>();
 if ["A","B","C","D","E","F","G"].iter().any(|b|found.iter().filter(|s|s==b).count()!=1){return fail("incomplete_report");}
 if score>=4.5&&!found.iter().any(|b|b=="H"){return fail("high_conviction_block_missing");}
 let visible=Regex::new(r"(?m)^\*\*Score:\*\*\s*(.*?)\s*$").unwrap();
 for c in visible.captures_iter(report){
  let value=c[1].trim().strip_suffix("/5").unwrap_or(c[1].trim()).trim().parse::<f64>();
  if value.ok()!=Some(score){return fail("score_conflict");}
 }
 let tier=crate::handle(&json!({"operation":"tier","score":score}))["tier"].clone();
 json!({"ok":true,"score":score,"tier":tier,"company":company,"title":role,"archetype":archetype,"legitimacy":legitimacy,"explanation":report.split("---SCORE_SUMMARY---").next().unwrap_or("").trim()})
}
#[cfg(test)]
mod tests{
 use super::*;
 fn fixture(score:&str)->Value{
  let blocks=('A'..='H').map(|b|format!("## {}. Retained block\nEvidence, uncertainties and a reasoned assessment.\n",b)).collect::<String>();
  json!({"operation":"parse_evaluation","company":"Fixture","title":"Engineer","report":format!("{}---SCORE_SUMMARY---\nCOMPANY: Fixture\nROLE: Engineer\nSCORE: {}\nARCHETYPE: Full Stack\nLEGITIMACY: High Confidence\n---END_SUMMARY---",blocks,score)})
 }
 #[test]fn every_score_threshold_routes_only_retained_value(){for(s,t)in[("1","T0"),("3.49","T0"),("3.5","T1"),("3.9","T1"),("4.0","T2"),("4.4","T2"),("4.5","T3"),("5","T3")]{assert_eq!(parse(&fixture(s))["tier"],t);}}
 #[test]fn malformed_and_partial_scores_are_not_t0(){for s in["","NaN","Infinity","4.6oops","0","5.1","null","true"]{assert_eq!(parse(&fixture(s))["ok"],false,"{}",s);}}
 #[test]fn identity_sections_and_conflicting_score_are_held(){
  let mut v=fixture("4.6");v["company"]=json!("Another");assert_eq!(parse(&v)["ok"],false);
  let mut v=fixture("4.6");v["report"]=json!(v["report"].as_str().unwrap().replace("## G.","## Z."));assert_eq!(parse(&v)["ok"],false);
  let mut v=fixture("4.6");v["report"]=json!(format!("**Score:** 2.0/5\n{}",v["report"].as_str().unwrap()));assert_eq!(parse(&v)["ok"],false);
  let mut v=fixture("4.6");v["report"]=json!(v["report"].as_str().unwrap().replace("## H.","## Z."));assert_eq!(parse(&v)["ok"],false);
 }
 #[test]fn duplicate_summary_is_ambiguous(){let mut v=fixture("4.2");v["report"]=json!(v["report"].as_str().unwrap().repeat(2));assert_eq!(parse(&v)["ok"],false);}
}
