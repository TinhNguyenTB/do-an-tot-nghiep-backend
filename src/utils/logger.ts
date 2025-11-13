import chalk from "chalk";

const info = (message: string) => {
  console.log(chalk.blue(`[INFO]: ${message}`));
};

const success = (message: string) => {
  console.log(chalk.green(`[SUCCESS]: ${message}`));
};

const warn = (message: string) => {
  console.log(chalk.yellow(`[WARN]: ${message}`));
};

const error = (message: string) => {
  console.log(chalk.red(`[ERROR]: ${message}`));
};

export const logger = {
  info,
  success,
  error,
  warn,
};
