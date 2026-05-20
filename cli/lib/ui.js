// UI 交互模块
import inquirer from 'inquirer';
import chalk from 'chalk';

// 分类列表
const CATEGORIES = [
  { id: 'all', name: '📚 All Categories', icon: '📚' },
  { id: 'code', name: '💻 Code', icon: '💻' },
  { id: 'art', name: '🎨 Art', icon: '🎨' },
  { id: 'writing', name: '✍️ Writing', icon: '✍️' },
  { id: 'business', name: '💼 Business', icon: '💼' },
  { id: 'game', name: '🎮 Game', icon: '🎮' },
  { id: 'learning', name: '📖 Learning', icon: '📖' }
];

// 选择分类
export async function selectCategory() {
  const { category } = await inquirer.prompt([
    {
      type: 'list',
      name: 'category',
      message: 'Select a category:',
      choices: CATEGORIES.map(c => ({
        name: c.name,
        value: c.id
      })),
      pageSize: 10
    }
  ]);
  return category;
}

// 选择 prompt
export async function selectPrompt(prompts) {
  if (prompts.length === 0) {
    return null;
  }

  // 截断内容用于显示
  const truncate = (str, len = 60) => 
    str.length > len ? str.slice(0, len) + '...' : str;

  const choices = prompts.map((p, i) => ({
    name: `${chalk.bold(p.title)} ${chalk.dim('[' + p.category + ']')}\n     ${chalk.gray(truncate(p.content, 50))}`,
    value: p,
    short: p.title
  }));

  const { selected } = await inquirer.prompt([
    {
      type: 'list',
      name: 'selected',
      message: 'Select a prompt:',
      choices,
      pageSize: 8
    }
  ]);

  return selected;
}

// 显示 prompt 详情
export function displayPrompt(prompt) {
  console.log('\n' + chalk.cyan('═'.repeat(50)));
  console.log(chalk.bold.cyan('  📝 ' + prompt.title));
  console.log(chalk.cyan('═'.repeat(50)));
  console.log(chalk.dim('  Category: ') + chalk.yellow(prompt.category || 'other'));
  console.log(chalk.dim('  Tags: ') + (prompt.tags || []).map(t => chalk.blue('#' + t)).join(' '));
  console.log(chalk.cyan('─'.repeat(50)));
  console.log(chalk.white('\n' + indentText(prompt.content, 2)));
  console.log(chalk.cyan('\n' + '═'.repeat(50)));
}

// 缩进文本
function indentText(text, spaces) {
  const indent = ' '.repeat(spaces);
  return text.split('\n').map(line => indent + line).join('\n');
}

// 确认操作
export async function confirmAction(message) {
  const { confirmed } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirmed',
      message,
      default: true
    }
  ]);
  return confirmed;
}

// 输入文本
export async function inputText(message, defaultVal = '') {
  const { text } = await inquirer.prompt([
    {
      type: 'input',
      name: 'text',
      message,
      default: defaultVal
    }
  ]);
  return text;
}
