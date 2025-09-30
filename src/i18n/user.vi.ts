import { EDUCATION_LEVELS } from "../types/userProfile";
export const EDUCATION_LEVELS_VI: Record<string, string> = {
    highSchool: "học cấp 3",
    vocationalSchool: "trung cấp",
    bachelorDegree: "đại học",
    masterDegree: "thạc sỹ",
    doctoralDegree: "Tiến sỹ",
}

export const workTypeOptions: Record<string, string> = {
    fullTime: "toàn thời gian",
    partTime: "bán thời gian",
    internship: "thực tập",
    remote: "Làm tại nhà",   
};
export const EDUCATION_LEVELS_OPTIONS = (Object.keys(EDUCATION_LEVELS_VI) as string[]).map(v => ({ value: v, label: EDUCATION_LEVELS_VI[v] }));
export const WORK_TYPE_OPTIONS = (Object.keys(workTypeOptions) as string[]).map(v => ({ value: v, label: workTypeOptions[v] }));

