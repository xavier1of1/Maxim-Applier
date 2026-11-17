use pulldown_cmark::{Event,Options,Parser,Tag};
use serde_json::{json,Value};
pub fn parse(input:&Value)->Value{
 let text=match input["text"].as_str(){Some(t) if t.len()<=350000=>t,_=>return json!({"ok":false,"error":{"code":"tracker_size"}})};
 let mut tables=Vec::new();let mut headers=Vec::<Value>::new();let mut rows=Vec::<Value>::new();let mut cells=Vec::<Value>::new();
 let(mut cell_text,mut links,mut cell_start,mut row_start,mut in_table,mut in_cell)=(String::new(),Vec::<String>::new(),0,0,false,false);
 for(event,range)in Parser::new_ext(text,Options::ENABLE_TABLES).into_offset_iter(){
  match event{
   Event::Start(Tag::Table(_))=>{in_table=true;headers.clear();rows.clear();}
   Event::Start(Tag::TableHead)=>{cells.clear();}
   Event::Start(Tag::TableRow)=>{cells.clear();row_start=range.start;}
   Event::Start(Tag::TableCell) if in_table=>{in_cell=true;cell_text.clear();links.clear();cell_start=range.start;}
   Event::Start(Tag::Link(_,destination,_)) if in_cell=>links.push(destination.to_string()),
   Event::Text(t)|Event::Code(t) if in_cell=>cell_text.push_str(&t),
   Event::SoftBreak|Event::HardBreak if in_cell=>cell_text.push('\n'),
   Event::End(Tag::TableCell) if in_cell=>{
    cells.push(json!({"text":cell_text,"raw":&text[cell_start..range.end],"links":links}));
    in_cell=false;
   }
   Event::End(Tag::TableHead)=>{headers=cells.clone();cells.clear();}
   Event::End(Tag::TableRow)=>{
    rows.push(json!({"cells":cells,"line":text[..row_start].bytes().filter(|b|*b==b'\n').count()+1}));
    if rows.len()>10000{return json!({"ok":false,"error":{"code":"tracker_row_limit"}});}
   }
   Event::End(Tag::Table(_))=>{tables.push(json!({"headers":headers,"rows":rows}));in_table=false;}
   _=>{}
  }
 }
 json!({"ok":true,"tables":tables})
}
#[cfg(test)]mod tests{
 use super::*;
 #[test]fn empty_cells_escaped_pipes_and_links_are_preserved(){
  let v=parse(&json!({"text":"| # | Company | Role | Score | Status | Report |\n|---|---|---|---|---|---|\n|1|Acme|Full \\| Stack||Evaluated|[1](reports/1.md)|\n"}));
  let row=&v["tables"][0]["rows"][0]["cells"];
  assert_eq!(row[2]["text"],"Full | Stack");assert_eq!(row[3]["text"],"");assert_eq!(row[4]["text"],"Evaluated");assert_eq!(row[5]["links"][0],"reports/1.md");
 }
 #[test]fn prose_is_not_a_tracker(){assert_eq!(parse(&json!({"text":"No tracker exists yet."}))["tables"],json!([]));}
}
