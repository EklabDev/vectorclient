type ExplorerMode = 'view' | 'edit';
interface Props {
    open: boolean;
    onClose: () => void;
    schemaId: string;
    schemaName: string;
    /** Initial system prompt from schema row; edit mode can PATCH it. */
    systemPrompt: string | null;
    mode: ExplorerMode;
    onSystemPromptSaved?: (prompt: string | null) => void;
    /** Called after create/update/delete chunk so parent can refresh card counts. */
    onWeaviateMutated?: () => void;
}
export declare function WeaviateExplorerModal({ open, onClose, schemaId, schemaName, systemPrompt: initialSystemPrompt, mode, onSystemPromptSaved, onWeaviateMutated, }: Props): import("react/jsx-runtime").JSX.Element | null;
export {};
