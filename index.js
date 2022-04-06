const shell = require('shelljs');
const fs = require('fs');
const { Octokit } = require("@octokit/rest");
const convert = require('xml-js');
let octokit;

async function main() {
    try {
        const orgName = "PipelineTest-VP";
        const gthubToken = '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';
        const dependencyRepoName = "dependency-details";

        octokit = new Octokit({ auth: gthubToken });

        await shell.mkdir('-p', 'repos');
        await shell.cd('repos');

        let nodeDependencies = {
            dependencies: []
        };
        let nodeDependenciesWithRepoName = [];

        let mavenDependencies = {
            dependencies: []
        };
        let mavenDependenciesWithRepoName = [];

        for(let loopVar = 1; loopVar < 1000; loopVar++) {
            const response = await octokit.rest.repos.listForOrg("GET /orgs/{org}/repos", {
                org: orgName,
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
                await shell.exec(`git clone ${repoUrl}`);
                
                if(fs.existsSync(`./${repoName}/package.json`)) {
                    const packageJson = JSON.parse(fs.readFileSync(`./${repoName}/package.json`, 'utf8'));
                    console.log(`package.json: ${JSON.stringify(packageJson)}`);
                    
                    const repoDependcies = getNodeRepoDependencies(packageJson);
                    nodeDependencies.dependencies = nodeDependencies.dependencies.concat(repoDependcies);
                    nodeDependenciesWithRepoName.push({
                        repoName: repoName,
                        dependencies: repoDependcies
                    });
                }

                if(fs.existsSync(`./${repoName}/pom.xml`)) {
                    const pomXml = fs.readFileSync(`./${repoName}/pom.xml`, 'utf8');
                    const jsonFromXml = await convert.xml2json(pomXml, {compact: true, spaces: 4});
                    console.log("jsonFromXml dependency: ", JSON.parse(jsonFromXml).project.dependencies);
                    
                    const repoDependcies = getMavenRepoDependencies(JSON.parse(jsonFromXml).project.dependencies);
                    mavenDependencies.dependencies = mavenDependencies.dependencies.concat(repoDependcies);
                    mavenDependenciesWithRepoName.push({
                        repoName: repoName,
                        dependencies: repoDependcies
                    });
                }
            }
        }
        await shell.cd('..');
        await shell.rm('-rf', 'repos');

        const dependencyRepoExists = await getDependencyRepoStatus(orgName, dependencyRepoName);
        console.log(`dependencyRepoExists: ${dependencyRepoExists}`);

        if(!dependencyRepoExists) {
            // create the repository
            const dependencyRepoCreResp = await octokit.rest.repos.createInOrg({
                name: dependencyRepoName,
                org: orgName,
                description: "This repository contains details for dependencies used in all the repositories in the organization.",
                private: true,
                auto_init: true
            });
            console.log(`dependencyRepoCreResp: ${JSON.stringify(dependencyRepoCreResp.data)}`);
        }
        shell.mkdir('-p', 'temp');
        shell.cd('temp');

        const dependencyRepoURL = `https://vishnuprabhakar7:${gthubToken}@github.com/${orgName}/${dependencyRepoName}.git`
        await shell.exec(`git clone ${dependencyRepoURL}`);

        await shell.cd(dependencyRepoName);

        fs.writeFileSync(`./node_dependencies.json`, JSON.stringify(nodeDependencies, null, 2));
        fs.writeFileSync(`./node_dependencies_with_repo.json`, JSON.stringify(nodeDependenciesWithRepoName, null, 2));
        fs.writeFileSync(`./maven_dependencies.json`, JSON.stringify(mavenDependencies, null, 2));
        fs.writeFileSync(`./maven_dependencies_with_repo.json`, JSON.stringify(mavenDependenciesWithRepoName, null, 2));

        await shell.exec(`git add .`);
        await shell.exec(`git commit -m "Updated dependency details"`);
        await shell.exec(`git push origin main`);

        console.log("Dependency details updated successfully");

        shell.cd('../..');
        await shell.rm('-rf', 'temp');
    } catch (error) {
        console.log(error);
    }
}

async function getDependencyRepoStatus(orgName, dependencyRepoName) {
    try {
        const response = await octokit.rest.repos.get({
            owner: orgName,
            repo: dependencyRepoName
        });
        console.log(`dependencyRepoStatus: ${JSON.stringify(response.data)}`);

        return true;
    } catch (error) {
        return false;
    }
}

function getNodeRepoDependencies(packageJson) {
    let dependencies = [];
    if(packageJson.dependencies) {
        for(let key in packageJson.dependencies) {
            dependencies.push({
                name: key,
                version: packageJson.dependencies[key]
            });
        }
    }
    return dependencies;
}

function getMavenRepoDependencies(dependencies) {
    let mavenDependencies = [];
    if(dependencies) {
        if(Array.isArray(dependencies)) {
            for(let i = 0; i < dependencies.length; i++) {
                const dependency = dependencies[i];
                mavenDependencies.push({
                    name: dependency.$.artifactId,
                    version: dependency.$.version
                });
            }
        } else {
            mavenDependencies.push({
                name: dependencies.dependency.artifactId,
                version: dependencies.dependency.version
            });
        }
    }
    return mavenDependencies;
}

main();