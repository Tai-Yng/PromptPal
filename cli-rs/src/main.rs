use std::fs;
use std::process::Command;
use dialoguer::Select;
use serde::Deserialize;

#[derive(Deserialize)]
struct Prompt {
    title: String,
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
    copy_to_clipboard(&prompt.content);
    println!("\n  [OK] \"{}\" copied to clipboard\n", prompt.title);
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
    Ok(prompts)
}
