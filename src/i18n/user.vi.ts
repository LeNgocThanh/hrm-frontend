import {EDUCATION_LEVELS} from "../types/userProfile";
export const EDUCATION_LEVELS_VI: Record<EDUCATION_LEVELS, string> = {
    highSchool : "học cấp 3",
    vocationalSchool : "trung cấp",
    bachelorDegree : "đại học",
    masterDegree : "thạc sỹ",
    doctoralDegree : "Tiến sỹ",
}
export const EDUCATION_LEVELS_OPTIONS = (Object.keys(EDUCATION_LEVELS) as EDUCATION_LEVELS[]).map(v => ({ value: v, label: EDUCATION_LEVELS_VI[v] }));