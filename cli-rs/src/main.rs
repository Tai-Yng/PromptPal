use std::fs;
use std::process::Command;
use dialoguer::Select;
use serde::Deserialize;

#[derive(Deserialize)]
struct Prompt {
    #[serde(default)]
    title: String,
    #[serde(default)]
    content: String,
    #[serde(default)]
    category: String,
    #[serde(default)]
    favorite: bool,
    #[serde(default)]
    use_count: u32,
}

fn main() {
    let prompts = match load_prompts() {
        Ok(p) if !p.is_empty() => p,
        Ok(_) => { eprintln!("\n  [--] No prompts found. Run PromptPal first.\n"); return; }
        Err(e) => { eprintln!("\n  [ERR] {}\n", e); return; }
    };

    // 构建带分类标题的选项列表，同时记录每个选项在 prompts 数组中的索引
    let mut items: Vec<String> = Vec::new();
    let mut prompt_indices: Vec<usize> = Vec::new();
    let mut last_cat = String::new();
    for (i, p) in prompts.iter().enumerate() {
        if p.category != last_cat {
            items.push(format!("--- {} ---", cat_label(&p.category)));
            prompt_indices.push(usize::MAX); // 分类标题标记
            last_cat = p.category.clone();
        }
        let star = if p.favorite { " ★" } else { "" };
        let count = if p.use_count > 0 { format!(" ({})", p.use_count) } else { String::new() };
        let title = if p.title.len() > 38 {
            format!("{}..", &p.title[..36])
        } else { p.title.clone() };
        items.push(format!("{}{}{}", title, star, count));
        prompt_indices.push(i);
    }

    let selected = match Select::new()
        .with_prompt("Select a prompt")
        .items(&items)
        .default(0)
        .interact_opt()
    {
        Ok(Some(i)) => i,
        _ => return,
    };

    let pi = prompt_indices.get(selected).copied().unwrap_or(usize::MAX);
    if pi == usize::MAX {
        // 用户选了分类标题行
        return;
    }
    let prompt = &prompts[pi];

    // 带变量的提示词：逐项填空（留空保留占位符），无变量直通
    let content = fill_variables_interactive(&prompt.content);
    copy_to_clipboard(&content);
    println!("\n  [OK] \"{}\" copied to clipboard\n", prompt.title);
}

// ===== 模板变量（与主面板 UI 同规则：双语法、-- 排除、1-40 字、去重保序） =====

/// 占位符扫描结果：(起始字节, 结束字节[不含], 变量名)
struct VarToken {
    start: usize,
    end: usize,
    name: String,
}

fn scan_variables(content: &str) -> Vec<VarToken> {
    let chars: Vec<(usize, char)> = content.char_indices().collect();
    let n = chars.len();
    let mut tokens = Vec::new();
    let mut seen = std::collections::HashSet::new();
    let mut i = 0;
    while i < n {
        let (byte_pos, c) = chars[i];
        // 识别开括号：[ 或 {{（{ 后须再跟一个 {）；前邻同类括号视为嵌套，跳过
        let prev_is_bracket = i > 0 && (chars[i - 1].1 == '[' || chars[i - 1].1 == '{');
        let (open_chars, close_ch) = if c == '[' && !prev_is_bracket {
            (1usize, ']')
        } else if c == '{' && !prev_is_bracket && i + 1 < n && chars[i + 1].1 == '{' {
            (2usize, '}')
        } else {
            i += 1;
            continue;
        };
        // 从 open 之后收集名字到 close；遇换行或同类开括号视为非法
        let mut j = i + open_chars;
        let mut name = String::new();
        let mut end: Option<usize> = None;
        let mut invalid = false;
        while j < n {
            let (b, cj) = chars[j];
            if cj == close_ch {
                if open_chars == 2 {
                    if j + 1 < n && chars[j + 1].1 == '}' {
                        end = Some(chars[j + 1].0 + 1);
                        break;
                    }
                } else {
                    end = Some(b + cj.len_utf8());
                    break;
                }
            }
            if cj == '\n' || cj == '[' || cj == '{' {
                invalid = true;
                break;
            }
            name.push(cj);
            j += 1;
        }
        if !invalid {
            if let Some(end_byte) = end {
                let trimmed = name.trim();
                let valid = !trimmed.is_empty()
                    && trimmed.chars().count() <= 40
                    && !trimmed.starts_with("--");
                if valid && seen.insert(trimmed.to_string()) {
                    tokens.push(VarToken { start: byte_pos, end: end_byte, name: trimmed.to_string() });
                }
                i = j + 1;
                continue;
            }
        }
        i += 1;
    }
    tokens
}

/// 替换：values 有非空值则替换，否则保留占位符原文
fn substitute(content: &str, tokens: &[VarToken], values: &std::collections::HashMap<String, String>) -> String {
    let mut out = String::with_capacity(content.len());
    let mut last = 0usize;
    for t in tokens {
        out.push_str(&content[last..t.start]);
        match values.get(&t.name).map(|v| v.trim()).filter(|v| !v.is_empty()) {
            Some(v) => out.push_str(v),
            None => out.push_str(&content[t.start..t.end]),
        }
        last = t.end;
    }
    out.push_str(&content[last..]);
    out
}

/// 交互填空：每个变量一项 Input，直接回车 = 留空保留占位符；取消则复制原文
fn fill_variables_interactive(content: &str) -> String {
    let tokens = scan_variables(content);
    if tokens.is_empty() {
        return content.to_string();
    }
    println!("\n  [var] {} variable(s) — Enter keeps placeholder\n", tokens.len());
    let mut values = std::collections::HashMap::new();
    for t in &tokens {
        let input = dialoguer::Input::<String>::new()
            .with_prompt(format!("  {}", t.name))
            .allow_empty(true)
            .interact_text();
        match input {
            Ok(v) if !v.trim().is_empty() => {
                values.insert(t.name.clone(), v);
            }
            Ok(_) => {}
            Err(_) => return content.to_string(),
        }
    }
    substitute(content, &tokens, &values)
}

fn cat_label(cat: &str) -> &str {
    match cat {
        "chat" => "Chat", "code" => "Code", "image" => "Image",
        "writing" => "Writing", _ => cat,
    }
}

fn copy_to_clipboard(text: &str) {
    let tmp = std::env::temp_dir().join(format!("pal_{}.txt", std::process::id()));
    let _ = fs::write(&tmp, text);
    let _ = Command::new("powershell")
        .args(["-NoProfile", "-Command", &format!(
            "Get-Content -Path '{}' -Encoding UTF8 | Set-Clipboard", tmp.display()
        )])
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .status();
    let _ = fs::remove_file(&tmp);
}

fn load_prompts() -> Result<Vec<Prompt>, String> {
    let home = dirs::home_dir().ok_or("Cannot find home directory")?;
    let path = home.join(".promptpal").join("promptpal_data.json");
    if !path.exists() {
        return Err("No data file. Run PromptPal first.".into());
    }
    let raw = fs::read_to_string(&path).map_err(|e| format!("Read error: {}", e))?;
    let root: serde_json::Value = serde_json::from_str(&raw).map_err(|e| format!("JSON: {}", e))?;

    let prompts: Vec<Prompt> = match &root["prompts"] {
        serde_json::Value::String(s) => serde_json::from_str(s).map_err(|e| format!("Parse: {}", e))?,
        serde_json::Value::Array(_) => serde_json::from_value(root["prompts"].clone()).map_err(|e| format!("Parse: {}", e))?,
        _ => return Err("Invalid data format".into()),
    };
    // 防御：跳过缺 title/content 的脏条目
    Ok(prompts.into_iter().filter(|p| !p.title.is_empty() && !p.content.is_empty()).collect())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn scan_dual_syntax_dedup_and_dash_exclusion() {
        let toks = scan_variables("画一张 [风格] 的 {{主体}}，--ar 16:9 [风格]");
        let names: Vec<&String> = toks.iter().map(|t| &t.name).collect();
        assert_eq!(names, vec!["风格", "主体"]);
    }

    #[test]
    fn substitute_keeps_empty_placeholder() {
        let tokens = scan_variables("[a] 和 {{b}}");
        let mut vals = std::collections::HashMap::new();
        vals.insert("b".to_string(), "一只猫".to_string());
        assert_eq!(substitute("[a] 和 {{b}}", &tokens, &vals), "[a] 和 一只猫");
    }

    #[test]
    fn nested_and_long_names_rejected() {
        assert!(scan_variables("[[嵌套]]").is_empty());
        let long = "x".repeat(41);
        assert!(scan_variables(&format!("[{}]", long)).is_empty());
    }
}
