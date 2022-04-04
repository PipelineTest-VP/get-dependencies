const shell = require('shelljs');
const fs = require('fs');
const { Octokit } = require("@octokit/rest");
var convert = require('xml-js');

async function main() {
    try {
        await shell.mkdir('-p', 'repos');
        await shell.cd('repos');

        const gthubToken = '<GITHUB_TOKEN>';

        const octokit = new Octokit({ auth: gthubToken });
        for(let loopVar = 1; loopVar < 1000; loopVar++) {
            const response = await octokit.rest.repos.listForOrg("GET /orgs/{org}/repos", {
                org: "PipelineTest-VP",
                type: "all",
                per_page: 100,
                page: loopVar
            });
            
            if(response.data.length == 0) {
                break;
            }

            for(let i = 0; i < response.data.length; i++) {
                const repo = response.data[i];
                const repoName = repo.name;
                const repoUrl = `https://vishnuprabhakar7:${gthubToken}@github.com/${repo.full_name}.git`;
                await shell.exec(`git clone ${repoUrl} ${repoName}`);
                if(fs.existsSync(`./${repoName}/package.json`)) {
                    const packageJson = JSON.parse(fs.readFileSync(`./${repoName}/package.json`, 'utf8'));
                    console.log(`package.json: ${JSON.stringify(packageJson)}`);
                }

                if(fs.existsSync(`./${repoName}/pom.xml`)) {
                    const pomXml = fs.readFileSync(`./${repoName}/pom.xml`, 'utf8');
                    const jsonFromXml = await convert.xml2json(pomXml, {compact: true, spaces: 4});
                    console.log("jsonFromXml dependency: ", JSON.parse(jsonFromXml).project.dependencies.dependency);
                }
            }
        }
        await shell.cd('..');
        await shell.rm('-rf', 'repos');
    } catch (error) {
        console.log(error);
    }
}

main();