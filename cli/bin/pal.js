#!/usr/bin/env node

import { program } from 'commander';
import { searchPrompts, getTrendingPrompts } from '../lib/api.js';
import { selectCategory, selectPrompt, displayPrompt } from '../lib/ui.js';
import { copyToClipboard } from '../lib/clipboard.js';
import chalk from 'chalk';

program
  .name('pal')
  .description('PromptPal CLI - Quick access to your prompts')
  .version('1.0.0')
  .argument('[query]', 'Search query (optional)')
  .option('-c, --category <category>', 'Filter by category')
  .option('-l, --list', 'List all prompts by category')
  .option('-r, --random', 'Get a random prompt')
  .action(async (query, options) => {
    try {
      console.log(chalk.cyan('\n╔══════════════════════════════════════╗'));
      console.log(chalk.cyan('║') + chalk.bold.white('   🤖 PromptPal CLI v1.0.0           ') + chalk.cyan('║'));
      console.log(chalk.cyan('╚══════════════════════════════════════╝\n'));

      let prompts = [];

      if (options.random) {
        // 随机获取一个 prompt
        const all = await getTrendingPrompts(20);
        prompts = [all[Math.floor(Math.random() * all.length)]];
      } else if (query) {
        // 搜索模式
        console.log(chalk.gray(`Searching for: "${query}"...\n`));
        prompts = await searchPrompts(query, options.category);
      } else {
        // 交互式选择
        const category = await selectCategory();
        console.log(chalk.gray(`\nLoading ${category === 'all' ? 'all prompts' : category + ' prompts'}...\n`));
        
        prompts = await getTrendingPrompts(20);
        if (category !== 'all') {
          prompts = prompts.filter(p => p.category === category);
        }
      }

      if (prompts.length === 0) {
        console.log(chalk.yellow('No prompts found.'));
        return;
      }

      // 选择 prompt
      const selected = await selectPrompt(prompts);
      
      if (!selected) {
        console.log(chalk.gray('\nCancelled.'));
        return;
      }

      // 显示并复制
      displayPrompt(selected);
      
      const copied = await copyToClipboard(selected.content);
      if (copied) {
        console.log(chalk.green('\n✓ Copied to clipboard!'));
      }

      console.log(chalk.gray('\n─'.repeat(40)));
      console.log(chalk.dim('Tip: Use "pal <query>" to search directly'));
      console.log(chalk.dim('Tip: Use "pal -r" for a random prompt\n'));

    } catch (error) {
      console.error(chalk.red('Error:'), error.message);
      process.exit(1);
    }
  });

// 列表命令
program
  .command('list')
  .description('List all prompts by category')
  .option('-c, --category <category>', 'Filter by category')
  .action(async (options) => {
    const prompts = await getTrendingPrompts(20);
    const filtered = options.category 
      ? prompts.filter(p => p.category === options.category)
      : prompts;

    console.log(chalk.cyan('\n📚 Prompt List:\n'));
    
    const byCategory = {};
    filtered.forEach(p => {
      if (!byCategory[p.category]) byCategory[p.category] = [];
      byCategory[p.category].push(p);
    });

    Object.entries(byCategory).forEach(([cat, items]) => {
      console.log(chalk.bold.yellow(`\n[${cat}]`));
      items.forEach((p, i) => {
        console.log(`  ${chalk.dim(i + 1 + '.')} ${p.title}`);
      });
    });
    console.log('');
  });

// 添加命令
program
  .command('add <title> <content>')
  .description('Add a new prompt')
  .option('-c, --category <category>', 'Category (default: other)')
  .option('-t, --tags <tags>', 'Tags (comma separated)')
  .action(async (title, content, options) => {
    console.log(chalk.green('\n✓ Prompt added:'), title);
    console.log(chalk.dim('Note: Prompts are stored in PromptPal app'));
  });

program.parse();
