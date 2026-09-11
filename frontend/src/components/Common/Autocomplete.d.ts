interface AutocompleteOption {
    id: string;
    label: string;
    [key: string]: any;
}
interface AutocompleteProps {
    options: AutocompleteOption[];
    selected: AutocompleteOption[];
    onChange: (selected: AutocompleteOption[]) => void;
    placeholder?: string;
    getOptionLabel?: (option: AutocompleteOption) => string;
}
export declare function Autocomplete({ options, selected, onChange, placeholder, getOptionLabel, }: AutocompleteProps): import("react/jsx-runtime").JSX.Element;
export {};
