import { useTheme } from "next-themes";

export const useCurrentTheme=()=>{
    const {theme,systemTheme}=useTheme();
    if(theme==="dark" || theme==="dark"){
        return theme;
    }
    return systemTheme;
}