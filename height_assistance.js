import { characters } from "../../../../script.js";
import { extension_settings, getContext } from "../../../extensions.js";
const extensionName = "st-group-utils";

function getCharacterByName(name){
    for (let i = 0; i < characters.length; i++) {
      const element = characters[i];
      if (element.name == name){
        return element
      }
    }
    return null;
}
function PredictHeight(description){
    const heightRegex = /([\d]+)(\ {0,}(ft|foot|feet|inches|inch|inc|in|km)\ {0,}(tall){0,1})/g
    const regexTest = heightRegex.exec(description)
    if (regexTest){
        // contains an explicit regex
        const height = parseInt(regexTest.groups[0])
        const measurement = regexTest.groups[2].toLowerCase()
        var inchesHeight = 0
        switch (measurement){
            case "km":
                inchesHeight = height * 39370
                break;
            case "ft" | "feet" | "foot":
                inchesHeight = height * 12
                break;
            case "in" | "inches" | "inch" | "inc":
                inchesHeight = height;
                break;
            default:
                inchesHeight = height * 12
        }
        return inchesHeight
    }
    const keywordRegex = /(tall|short)/.exec(description)
    if (keywordRegex)
    {
        const measurement = keywordRegex.groups[0].toLowerCase()
        switch (measurement){
            case "tall":
                return 6;
            case "short":
                return 4;
            default:
                return 5;
        }
    }
    return 5
}

export async function onRearrangeChat(chat){
    const context = getContext();
    const group = getGroup(context.groupId);
    const generating_name = context.name2;
    if (!group) return;
    if (!extension_settings[extensionName].share_character_info) return;
    const generatingHeight = await (new Promise((resolve,reject)=>{
        const character = getCharacterByName(generating_name);
        if (character){
            resolve(PredictHeight(character.description))
        }else
            resolve(5)
    }))
    let system_notes = [];

    // Create an array of promises for getting character descriptions and personalities
    const descriptionPromises = group.members.map(async (element) => {
      const character = getCharacterByName(element.split(".png")[0]);
      if (character && character.name != generating_name) {
        if (character.description.length > 0 && character.personality.length > 0) {
          const desc = character.description;
          const height = PredictHeight(desc)
          if (generatingHeight < height){
            system_notes.push(`[System Note: ${character.name} must look up at ${generating_name}]`)
          } else if (generatingHeight > height) {
            system_notes.push(`[System Note: ${character.name} must look down upon ${generating_name}]`)
          } else {
            system_notes.push(`[System Note: ${character.name} is same height as ${generating_name}]`)
          }
        }
      }
      return character;
    });
    await Promise.all(descriptionPromises);
    if (system_notes.length > 0) {
      const systemNote = {
        "name": "System",
        "is_user": false,
        "is_system": "",
        "send_date": new Date(Date.now()).toString(),
        "mes": system_notes.join("\n"),
      };
      chat.splice(chat.length - 1, 0, systemNote);
      console.log(`Height difference detected. Chat Modified using notes:\n- ${system_notes.join("\n- ")}`)
    }
}