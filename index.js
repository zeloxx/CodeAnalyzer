const fs = require("fs");
const path = require("path");
const babelParser = require("@babel/parser");
const traverse = require("@babel/traverse").default;
const generate = require("@babel/generator").default;
const agnes = require("ml-hclust").agnes;
const { ESLint } = require("eslint");
const {
  Worker,
  isMainThread,
  parentPort,
  workerData,
} = require("worker_threads");
const jqgram = require("jqgram").jqgram;

class FileHandler {
  getAllFilePaths(dirPath, arrayOfFiles) {
    const files = fs.readdirSync(dirPath);

    arrayOfFiles = arrayOfFiles || [];

    files.forEach((file) => {
      if (fs.statSync(dirPath + "/" + file).isDirectory()) {
        arrayOfFiles = this.getAllFilePaths(dirPath + "/" + file, arrayOfFiles);
      } else {
        if (
          path.extname(file) === ".js" ||
          path.extname(file) === ".jsx" ||
          path.extname(file) === ".ts" ||
          path.extname(file) === ".tsx"
        ) {
          arrayOfFiles.push(path.join(dirPath, "/", file));
        }
      }
    });

    return arrayOfFiles;
  }

  readFileContent(filePath) {
    return fs.readFileSync(filePath, "utf-8");
  }
}

class CodeParser {
  parseCode(fileContent) {
    return babelParser.parse(fileContent, {
      sourceType: "module",
      plugins: [
        "jsx",
        "typescript",
        "optionalChaining",
        "nullishCoalescingOperator",
        "objectRestSpread",
      ],
      errorRecovery: true,
    });
  }

  traverseAST(ast, visitor) {
    traverse(ast, visitor);
  }

  generateCodeFromAST(ast) {
    return generate(ast).code;
  }
}

class CodeNormalizer {
  async normalizeCodeWithESLint(code) {
    const eslint = new ESLint({ fix: true });
    const results = await eslint.lintText(code, { filePath: "temp.ts" }); // Add a temporary file path with .ts extension
    const fixedCode = (results[0] && results[0].output) || code;
    return fixedCode;
  }

  async generateNormalizedAST(code) {
    const normalizedCode = await this.normalizeCodeWithESLint(code);
    let ast = babelParser.parse(normalizedCode, {
      sourceType: "module",
      plugins: [
        "jsx",
        "typescript",
        "optionalChaining",
        "nullishCoalescingOperator",
        "objectRestSpread",
      ],
      errorRecovery: true,
    });

    return ast;
  }
}

class ASTAnalyzer {
  calculateASTNodeCount(ast) {
    let count = 0;

    function traverse(node) {
      count++;
      for (const key in node) {
        if (node.hasOwnProperty(key)) {
          const child = node[key];
          if (typeof child === "object" && child !== null) {
            traverse(child);
          }
        }
      }
    }

    traverse(ast);
    return count;
  }

  convertAstForEditDistance(node) {
    if (!node) {
      return null;
    }

    const newNode = {
      label: node.type,
      children: [],
    };

    for (const [key, child] of Object.entries(node)) {
      if (key !== "type" && key !== "loc" && key !== "start" && key !== "end") {
        if (Array.isArray(child)) {
          child.forEach((item) => {
            if (typeof item === "object" && item !== null) {
              newNode.children.push(this.convertAstForEditDistance(item));
            }
          });
        } else if (typeof child === "object" && child !== null) {
          newNode.children.push(this.convertAstForEditDistance(child));
        }
      }
    }

    return newNode;
  }

  calculateASTPQGramDistance(ast1, ast2) {
    return new Promise((resolve) => {
      const convertedAst1 = this.convertAstForEditDistance(ast1);
      const convertedAst2 = this.convertAstForEditDistance(ast2);

      jqgram.distance(
        {
          root: convertedAst1,
          lfn: (node) => node.label,
          cfn: (node) => node.children,
        },
        {
          root: convertedAst2,
          lfn: (node) => node.label,
          cfn: (node) => node.children,
        },
        { p: 2, q: 3, depth: 10 },
        (result) => {
          const distance = result.distance;
          resolve(distance);
        }
      );
    });
  }

  async calculateASTPQGramSimilarity(ast1, ast2) {
    const pqGramDistance = await this.calculateASTPQGramDistance(ast1, ast2);
    const maxPQGramDistance =
      this.calculateASTNodeCount(ast1) + this.calculateASTNodeCount(ast2);
    const similarity = 1 - pqGramDistance / maxPQGramDistance;
    return similarity;
  }
}

class DistanceCalculator {
  async calculateDistancesBetweenCodeSnippets(normalizedFunctions) {
    const codeSnippets = normalizedFunctions;
    const distances = Array.from({ length: codeSnippets.length }, () =>
      Array(codeSnippets.length).fill(0)
    );

    let maxDistance = 0;

    const numWorkers = 20; // should make this dynamic
    const chunkSize = Math.ceil(codeSnippets.length / numWorkers);
    const distancePromises = [];

    for (let i = 0; i < codeSnippets.length; i += chunkSize) {
      const endIndex = Math.min(i + chunkSize, codeSnippets.length);
      distancePromises.push(
        this.calculateDistancesInWorker(normalizedFunctions, i, endIndex)
      );
    }

    const distanceChunks = await Promise.all(distancePromises);

    // combine the results from all workers
    for (let i = 0; i < codeSnippets.length; i++) {
      for (let j = 0; j < codeSnippets.length; j++) {
        const chunkIndex = Math.floor(i / chunkSize);
        const chunkOffset = i % chunkSize;
        const value =
          distanceChunks[chunkIndex][chunkOffset * codeSnippets.length + j];
        if (value !== null) {
          distances[i][j] = value;
          maxDistance = Math.max(maxDistance, value);
        }
      }
      console.log(i);
    }

    // normalize distance values
    for (let i = 0; i < codeSnippets.length; i++) {
      for (let j = 0; j < codeSnippets.length; j++) {
        distances[i][j] /= maxDistance;
      }
    }

    return {
      distances,
      codeSnippets,
    };
  }

  async calculateDistancesInWorker(normalizedFunctions, startIndex, endIndex) {
    return new Promise((resolve, reject) => {
      const worker = new Worker(__filename, {
        workerData: {
          normalizedFunctions,
          startIndex,
          endIndex,
        },
      });

      worker.on("message", resolve);
      worker.on("error", reject);
      worker.on("exit", (code) => {
        if (code !== 0) {
          reject(new Error(`Worker stopped with exit code ${code}`));
        }
      });
    });
  }
}

class ClusterJSONBuilder {
  getMaxHeight(node) {
    if (node.isLeaf) {
      return 0;
    } else {
      const leftHeight = this.getMaxHeight(node.children[0]);
      const rightHeight = this.getMaxHeight(node.children[1]);
      return Math.max(leftHeight, rightHeight, node.height);
    }
  }

  buildClusterJSON(
    node,
    codeSnippets,
    maxNodeHeight,
    similarityThreshold = 0,
    similarity = null
  ) {
    const newSimilarity = 1 - node.height / maxNodeHeight;

    if (node.isLeaf) {
      const codeSnippet = codeSnippets[node.index];
      return {
        id: `snippet${node.index}`,
        codeSnippet: {
          name: codeSnippet.functionNames.join(", "),
          code: codeSnippet.code,
          filePath: codeSnippet.filePath,
          startPosition: codeSnippet.startPosition,
          endPosition: codeSnippet.endPosition,
        },
      };
    } else {
      const leftJSON = this.buildClusterJSON(
        node.children[0],
        codeSnippets,
        maxNodeHeight,
        similarityThreshold,
        newSimilarity
      );
      const rightJSON = this.buildClusterJSON(
        node.children[1],
        codeSnippets,
        maxNodeHeight,
        similarityThreshold,
        newSimilarity
      );

      const members = [];
      if (leftJSON) {
        members.push(leftJSON);
      }
      if (rightJSON) {
        members.push(rightJSON);
      }

      const group = {
        id: `group${+new Date()}`,
        size: members.length,
        similarity: newSimilarity,
        members: members,
      };

      if (similarity !== null && newSimilarity < similarityThreshold) {
        group.isBelowThreshold = true;
      }

      return group;
    }
  }

  pruneClusterJSON(clusterJSON, similarityThreshold, codeNormalizer) {
    const prunedGroups = [];

    function prune(cluster) {
      if (cluster.codeSnippet) {
        return;
      }

      if (cluster.similarity >= similarityThreshold) {
        prunedGroups.push(cluster);
      } else {
        cluster.members.forEach((member) => {
          prune(member);
        });
      }
    }

    function convertASTtoCode(group) {
      group.members.forEach((member) => {
        if (member.codeSnippet) {
          let funcCode = generate(member.codeSnippet.code).code;
          member.codeSnippet.code = funcCode;
        } else {
          convertASTtoCode(member);
        }
      });
    }

    prune(clusterJSON);
    prunedGroups.forEach((group) => {
      convertASTtoCode(group);
    });

    return prunedGroups;
  }
}

class CodeAnalyzer {
  constructor() {
    this.fileHandler = new FileHandler();
    this.codeParser = new CodeParser();
    this.codeNormalizer = new CodeNormalizer();
    this.astAnalyzer = new ASTAnalyzer();
    this.distanceCalculator = new DistanceCalculator();
    this.clusterJSONBuilder = new ClusterJSONBuilder();
  }

  findAllFunctions(folders) {
    const allFunctions = [];

    folders.forEach((folderPath) => {
      const files = this.fileHandler.getAllFilePaths(folderPath);
      files.forEach((filePath) => {
        try {
          const fileContent = this.fileHandler.readFileContent(filePath);
          const ast = this.codeParser.parseCode(fileContent);
          this.codeParser.traverseAST(ast, {
            FunctionDeclaration: (nodePath) => {
              const functionName = nodePath.node.id.name;
              const generatedCode = this.codeParser.generateCodeFromAST(
                nodePath.node
              );
              const startPosition = nodePath.node.loc.start;
              const endPosition = nodePath.node.loc.end;

              allFunctions.push(
                this.createCodeSnippet(
                  generatedCode,
                  1,
                  [functionName],
                  filePath,
                  startPosition,
                  endPosition
                )
              );
            },

            VariableDeclarator: (nodePath) => {
              if (
                nodePath.node.init &&
                nodePath.node.init.type === "ArrowFunctionExpression"
              ) {
                const functionName = nodePath.node.id.name;
                const generatedCode = `const ${functionName} = ${this.codeParser.generateCodeFromAST(
                  nodePath.node.init
                )}`;
                const startPosition = nodePath.node.loc.start;
                const endPosition = nodePath.node.loc.end;

                allFunctions.push(
                  this.createCodeSnippet(
                    generatedCode,
                    1,
                    [functionName],
                    filePath,
                    startPosition,
                    endPosition
                  )
                );
              }
            },
          });
        } catch (error) {
          console.error(`Error parsing file: ${filePath}`);
          console.error(error);
        }
      });
    });

    return allFunctions;
  }

  createCodeSnippet(
    code,
    count,
    functionNames,
    filePath,
    startPosition,
    endPosition
  ) {
    return {
      code,
      count,
      functionNames,
      filePath,
      startPosition,
      endPosition,
    };
  }

  async analyzeCode(folders, similarityThreshold = 0) {
    const allFunctions = this.findAllFunctions(folders);
    const normalizedFunctions = await Promise.all(
      allFunctions.map(async (func) => {
        const normalizedCode = await this.codeNormalizer.generateNormalizedAST(
          func.code
        );
        return {
          ...func,
          code: normalizedCode,
        };
      })
    );
    const { distances, codeSnippets } =
      await this.distanceCalculator.calculateDistancesBetweenCodeSnippets(
        normalizedFunctions
      );

    // group similarities in a hierarchical tree
    const linkageType = "average";
    const rootNode = agnes(distances, { method: linkageType });

    // get max height (distance) value of the tree
    const maxNodeHeight = this.clusterJSONBuilder.getMaxHeight(rootNode);

    // create json representation of the tree
    const clusterJSON = this.clusterJSONBuilder.buildClusterJSON(
      rootNode,
      codeSnippets,
      maxNodeHeight,
      similarityThreshold
    );

    // prune the tree based on the similarity threshold
    const prunedClusterJSON = this.clusterJSONBuilder.pruneClusterJSON(
      clusterJSON,
      similarityThreshold,
      this.codeNormalizer
    );

    return prunedClusterJSON;
  }
}

function generateExportString(obj) {
  if (Array.isArray(obj)) {
    return `[${obj.map(generateExportString).join(", ")}]`;
  } else if (typeof obj === "object") {
    if (obj.codeSnippet) {
      const cleanedCode = obj.codeSnippet.code.replace(/\s+/g, " ");
      obj = {
        ...obj,
        codeSnippet: {
          ...obj.codeSnippet,
          code: cleanedCode,
        },
      };
    }
    const entries = Object.entries(obj)
      .map(([key, value]) => `${key}: ${generateExportString(value)}`)
      .join(", ");
    return `{${entries}}`;
  } else {
    return JSON.stringify(obj);
  }
}

// example
(async () => {
  if (isMainThread) {
    (async () => {
      const codeAnalyzer = new CodeAnalyzer();
      const folders = [
        "C:\\Users\\rober\\OneDrive\\Documents\\GitHub\\MAIN\\CodeAnalyzer\\testts",
      ];
      const prunedClusterJSON = await codeAnalyzer.analyzeCode(folders, 0);

      // write the output to a .js file and export the object
      console.log(prunedClusterJSON);
      const outputFileContent = `module.exports = ${generateExportString(
        prunedClusterJSON
      )};`;
      fs.writeFileSync("clusters.js", outputFileContent);
    })();
  } else {
    // worker thread code
    const { normalizedFunctions, startIndex, endIndex } = workerData;
    const codeAnalyzer = new CodeAnalyzer();
    const distances = [];

    for (let i = startIndex; i < endIndex; i++) {
      console.log({ i });
      const ast1 = normalizedFunctions[i].code;
      for (let j = 0; j < normalizedFunctions.length; j++) {
        if (i === j) {
          distances.push(0);
        } else if (j < i) {
          const ast2 = normalizedFunctions[j].code;
          const distance =
            1 -
            (await codeAnalyzer.astAnalyzer.calculateASTPQGramSimilarity(
              ast1,
              ast2
            ));
          distances.push(distance);
        } else {
          distances.push(null); // placeholder for values to be filled in by other workers
        }
      }
    }

    parentPort.postMessage(distances);
  }
})();
