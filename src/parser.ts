import type {App, TFile} from "obsidian";
import {parseYaml} from "obsidian";
import {MetaType} from "./Types/metaType";

export type Property = {key: string, content: any, type: MetaType};

export default class MetaEditParser {
    private app: App;

    constructor(app: App) {
        this.app = app;
    }

    public async getTagsForFile(file: TFile): Promise<Property[]> {
        const cache = this.app.metadataCache.getFileCache(file);
        if (!cache) return [];
        const tags = cache.tags;
        if (!tags) return [];

        let mTags: Property[] = [];
        tags.forEach(tag => mTags.push({key: tag.tag, content: tag.tag, type: MetaType.Tag}));
        return mTags;
    }

    public async parseFrontmatter(file: TFile): Promise<Property[]> {
        const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
        if (!frontmatter) return [];
        const {position: {start, end}} = frontmatter;
        const filecontent = await this.app.vault.cachedRead(file);

        const yamlContent: string = filecontent.split("\n").slice(start.line, end.line).join("\n");
        const parsedYaml = parseYaml(yamlContent);

        let metaYaml: Property[] = [];

        for (const key in parsedYaml) {
            const value = parsedYaml[key];
            // Quite horrible way of checking if is a nested key/group. 
            // It works for my current use case but needs cleanup
            // todo: Refactor this code lines 40-50
            if (typeof value === 'string' || value instanceof String || !isNaN(value) || key === 'tags') {
                metaYaml.push({key: key, content: value, type: MetaType.YAML});
            }
            else {
                for (const nestedKey in value) {
                    const subKey = key + "." + nestedKey; 
                    metaYaml.push({key: subKey, content: value[nestedKey], type: MetaType.YAML});
                }
            }
        }

        return metaYaml;
    }

    public async parseInlineFields(file: TFile): Promise<Property[]> {
        const content = await this.app.vault.cachedRead(file);

        return content.split("\n").reduce((obj: Property[], str: string) => {
            let parts = str.split("::");

            if (parts[0] && parts[1]) {
                obj.push({key: parts[0], content: parts[1].trim(), type: MetaType.Dataview});
            }
            else if (str.includes("::")) {
                const key: string = str.replace("::",'');
                obj.push({key, content: "", type: MetaType.Dataview});
            }

            return obj;
        },  []);
    }

}
