import { characters } from "../../../../script.js";
import { extension_settings, getContext } from "../../../extensions.js";
import { groups } from "../../../group-chats.js";
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
    if (regexTest && regexTest.length >= 3){
        // contains an explicit regex
        const height = parseInt(regexTest[1])
        const measurement = regexTest[3].toLowerCase()
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
    const keywordRegex = /(tall|short)/g.exec(description)
    if (keywordRegex && keywordRegex.length >= 2)
    {
        const measurement = keywordRegex.groups[1].toLowerCase()
        switch (measurement){
            case "tall":
                return 6*15;
            case "short":
                return 4*15;
            default:
                return 60; //measured in inches so 5 ft = 60 inches
        }
    }
    console.warn("No height was found. Please include a height in the characters description if they are any taller or shorter than 5ft")
    return 60 //measured in inches so 5 ft = 60 inches
}

function getGroup(groupId){
  const group = groups.find((x) => x.id.toString() === groupId);
  if (!group) {
    return;
  }
  return group
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