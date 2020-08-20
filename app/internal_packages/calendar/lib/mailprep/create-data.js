const fs = require('fs');

function main() {
  console.log('Creating export js file for test cases');

  const input = './test/testinput';
  const output = './test/testoutput';
  const outputJsFile = './test/index.js';

  const inputFiles = new Set(fs.readdirSync(input));
  const outputFiles = new Set(fs.readdirSync(output));

  const data = [];
  const allInputOutput = [];

  // Create the jsFile here, join them later.
  // If you can find a corresponding element in the output file,
  // it is a test case.
  inputFiles.forEach((value) => {
    if (outputFiles.has(value)) {
      let fileName = value.split(/-|\)|\(| |,|.json/g);
      fileName = fileName
        .map((substr) => substr.charAt(0).toUpperCase() + substr.slice(1))
        .join('');
      data.push(`import * as ${fileName}Input from './testinput/${value}';`);
      data.push(`import * as ${fileName}Output from './testoutput/${value}';\n`);
      allInputOutput.push(`[${fileName}Input, ${fileName}Output]\n`);
    }
  });

  data.push(`export default [\n\t${allInputOutput}]`);

  fs.writeFileSync(outputJsFile, data.join('\n'), (err) => console.log(err));
}
main();
