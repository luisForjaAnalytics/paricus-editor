"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { EditorContent, EditorContext, useEditor } from "@tiptap/react";

// --- Tiptap Core Extensions ---
import { StarterKit } from "@tiptap/starter-kit";
import { CustomImage } from "@/extensions/custom-image";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import { TextAlign } from "@tiptap/extension-text-align";
import { Typography } from "@tiptap/extension-typography";
import { Highlight } from "@tiptap/extension-highlight";
import { Subscript } from "@tiptap/extension-subscript";
import { Superscript } from "@tiptap/extension-superscript";
import { Underline } from "@tiptap/extension-underline";
import { Color } from "@tiptap/extension-color";
import { TextStyle } from "@tiptap/extension-text-style";
import { FontFamily } from "@tiptap/extension-font-family";
import { Selection } from "@tiptap/extensions";
import { FontSize } from "@/extensions/font-size";
import { LineHeight } from "@/extensions/line-height";
import { Indent } from "@/extensions/indent";
import { CustomTable } from "@/extensions/custom-table";
import { TableRow } from "@tiptap/extension-table-row";
import { CustomTableCell, CustomTableHeader } from "@/extensions/custom-table-cell";
import { TableLayout } from "@/extensions/table-layout";
import { RowResize } from "@/extensions/row-resize";
import { PageBreak } from "@/extensions/page-break";
import { Bookmark } from "@/extensions/bookmark";
import { TableOfContents } from "@/extensions/table-of-contents";

// --- UI Primitives ---
import { Button } from "@/components/tiptap-ui-primitive/button";
import { Spacer } from "@/components/tiptap-ui-primitive/spacer";
import {
  Toolbar,
  ToolbarGroup,
  ToolbarSeparator,
} from "@/components/tiptap-ui-primitive/toolbar";

// --- Tiptap Node ---
import { ImageUploadNode } from "@/components/tiptap-node/image-upload-node/image-upload-node-extension";
import { HorizontalRule } from "@/components/tiptap-node/horizontal-rule-node/horizontal-rule-node-extension";
import "@/components/tiptap-node/blockquote-node/blockquote-node.scss";
import "@/components/tiptap-node/code-block-node/code-block-node.scss";
import "@/components/tiptap-node/horizontal-rule-node/horizontal-rule-node.scss";
import "@/components/tiptap-node/list-node/list-node.scss";
import "@/components/tiptap-node/image-node/image-node.scss";
import "@/components/tiptap-node/heading-node/heading-node.scss";
import "@/components/tiptap-node/paragraph-node/paragraph-node.scss";
import "@/components/tiptap-node/table-node/table-node.scss";
import "@/components/tiptap-node/page-break-node/page-break-node.scss";
import "@/components/tiptap-node/table-of-contents-node/table-of-contents-node.scss";

// --- Tiptap UI ---
import { HeadingDropdownMenu } from "@/components/tiptap-ui/heading-dropdown-menu";
import { ImageUploadButton } from "@/components/tiptap-ui/image-upload-button";
import { ListDropdownMenu } from "@/components/tiptap-ui/list-dropdown-menu";
import { BlockquoteButton } from "@/components/tiptap-ui/blockquote-button";
import { IndentButton } from "@/components/tiptap-ui/indent-button";
import { CodeBlockButton } from "@/components/tiptap-ui/code-block-button";
import {
  ColorHighlightPopover,
  ColorHighlightPopoverContent,
  ColorHighlightPopoverButton,
} from "@/components/tiptap-ui/color-highlight-popover";
import {
  LinkPopover,
  LinkContent,
  LinkButton,
} from "@/components/tiptap-ui/link-popover";
import { MarkButton } from "@/components/tiptap-ui/mark-button";
import { TextAlignButton } from "@/components/tiptap-ui/text-align-button";
import { UndoRedoButton } from "@/components/tiptap-ui/undo-redo-button";
import { PdfExportButton } from "@/components/tiptap-ui/pdf-export-button";
import { DocxImportButton } from "@/components/tiptap-ui/docx-import-button";
import { DocxExportButton } from "@/components/tiptap-ui/docx-export-button";
import { HtmlImportButton } from "@/components/tiptap-ui/html-import-button";
import { TableDropdownMenu, TableEditMenu } from "@/components/tiptap-ui/table-dropdown-menu";
import { RemoveFormattingButton } from "@/components/tiptap-ui/remove-formatting-button";
import { PageBreakButton } from "@/components/tiptap-ui/page-break-button";
import { BookmarkButton } from "@/components/tiptap-ui/bookmark-button";
import { TocButton } from "@/components/tiptap-ui/toc-button";
import { SpecialCharsButton } from "@/components/tiptap-ui/special-chars-button";
import { FontFamilyDropdown } from "@/components/tiptap-ui/font-family-dropdown";
import { FontSizeDropdown } from "@/components/tiptap-ui/font-size-dropdown";
import { LineHeightDropdown } from "@/components/tiptap-ui/line-height-dropdown";
import { LanguageSwitcher } from "@/components/tiptap-ui/language-switcher";
import { ToolbarPanel } from "@/components/tiptap-ui/toolbar-panel/toolbar-panel";

// --- Icons ---
import { ArrowLeftIcon } from "@/components/tiptap-icons/arrow-left-icon";
import { HighlighterIcon } from "@/components/tiptap-icons/highlighter-icon";
import { LinkIcon } from "@/components/tiptap-icons/link-icon";

// --- Hooks ---
import { useIsBreakpoint } from "@/hooks/use-is-breakpoint";
import { useWindowSize } from "@/hooks/use-window-size";
import { useCursorVisibility } from "@/hooks/use-cursor-visibility";

// --- Lib ---
import { handleImageUpload, MAX_FILE_SIZE } from "@/lib/tiptap-utils";

// --- Styles ---
import "@/components/tiptap-templates/simple/simple-editor.scss";


// SVG icons for compact toolbar menu triggers
const TextIcon = ({ className }) => (
  <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 7V4h16v3" /><path d="M9 20h6" /><path d="M12 4v16" />
  </svg>
);
const ParagraphIcon = ({ className }) => (
  <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M13 4v16" /><path d="M17 4v16" /><path d="M13 4H9a4 4 0 0 0 0 8h4" />
  </svg>
);
const InsertIcon = ({ className }) => (
  <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" /><path d="M12 8v8" /><path d="M8 12h8" />
  </svg>
);
const ImportExportIcon = ({ className }) => (
  <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3v18" /><path d="m8 6-4 4 4 4" /><path d="m16 10 4 4-4 4" />
  </svg>
);

const CompactToolbarContent = ({ onHighlighterClick, onLinkClick, isMobile }) => {
  const { t } = useTranslation();
  const [activePanel, setActivePanel] = useState(null);

  const handlePanelChange = (id) => (open) => {
    setActivePanel(open ? id : null);
  };

  return (
    <>
      <Spacer />
      <ToolbarGroup>
        <UndoRedoButton action="undo" />
        <UndoRedoButton action="redo" />
      </ToolbarGroup>
      <ToolbarSeparator />
      <ToolbarGroup>
        {/* Menu 1: Text */}
        <ToolbarPanel
          icon={<TextIcon className="tiptap-button-icon" />}
          label={t("toolbar.menuText")}
          open={activePanel === "text"}
          onOpenChange={handlePanelChange("text")}
        >
          <div className="toolbar-panel-row">
            <FontFamilyDropdown portal />
            <FontSizeDropdown portal />
            <LineHeightDropdown portal />
          </div>
          <div className="toolbar-panel-separator" />
          <div className="toolbar-panel-row">
            <MarkButton type="bold" />
            <MarkButton type="italic" />
            <MarkButton type="strike" />
            <MarkButton type="underline" />
            <MarkButton type="code" />
            <MarkButton type="superscript" />
            <MarkButton type="subscript" />
          </div>
          <div className="toolbar-panel-separator" />
          <div className="toolbar-panel-row">
            {!isMobile ? (
              <ColorHighlightPopover />
            ) : (
              <ColorHighlightPopoverButton onClick={onHighlighterClick} />
            )}
            <RemoveFormattingButton />
          </div>
        </ToolbarPanel>

        {/* Menu 2: Paragraph */}
        <ToolbarPanel
          icon={<ParagraphIcon className="tiptap-button-icon" />}
          label={t("toolbar.menuParagraph")}
          open={activePanel === "paragraph"}
          onOpenChange={handlePanelChange("paragraph")}
        >
          <div className="toolbar-panel-row">
            <HeadingDropdownMenu levels={[1, 2, 3, 4]} portal />
            <ListDropdownMenu
              types={["bulletList", "orderedList", "taskList"]}
              portal
            />
            <IndentButton direction="indent" />
            <IndentButton direction="outdent" />
          </div>
          <div className="toolbar-panel-separator" />
          <div className="toolbar-panel-row">
            <TextAlignButton align="left" />
            <TextAlignButton align="center" />
            <TextAlignButton align="right" />
            <TextAlignButton align="justify" />
          </div>
          <div className="toolbar-panel-separator" />
          <div className="toolbar-panel-row">
            <BlockquoteButton />
            <CodeBlockButton />
          </div>
        </ToolbarPanel>

        {/* Menu 3: Insert */}
        <ToolbarPanel
          icon={<InsertIcon className="tiptap-button-icon" />}
          label={t("toolbar.menuInsert")}
          open={activePanel === "insert"}
          onOpenChange={handlePanelChange("insert")}
        >
          <div className="toolbar-panel-row">
            <ImageUploadButton />
            <TableDropdownMenu portal />
            <TableEditMenu portal />
            {!isMobile ? <LinkPopover /> : <LinkButton onClick={onLinkClick} />}
          </div>
          <div className="toolbar-panel-separator" />
          <div className="toolbar-panel-row">
            <PageBreakButton />
            <BookmarkButton portal />
            <TocButton />
            <SpecialCharsButton portal />
          </div>
        </ToolbarPanel>

        {/* Menu 4: Import/Export */}
        <ToolbarPanel
          icon={<ImportExportIcon className="tiptap-button-icon" />}
          label={t("toolbar.menuImportExport")}
          open={activePanel === "importexport"}
          onOpenChange={handlePanelChange("importexport")}
        >
          <div className="toolbar-panel-row">
            <DocxImportButton />
            <HtmlImportButton />
            <DocxExportButton />
            <PdfExportButton />
          </div>
        </ToolbarPanel>

        <ToolbarSeparator />

        {/* Menu 5: Language (direct, no panel) */}
        <LanguageSwitcher />
      </ToolbarGroup>
      <Spacer />
    </>
  );
};

const MainToolbarContent = ({ onHighlighterClick, onLinkClick, isMobile, responsive = true }) => {
  const { t } = useTranslation();
  const isCompact = useIsBreakpoint("max", 1024);

  if (isCompact) {
    if (!responsive) return null;
    return (
      <CompactToolbarContent
        onHighlighterClick={onHighlighterClick}
        onLinkClick={onLinkClick}
        isMobile={isMobile}
      />
    );
  }

  return (
    <>
      <Spacer />
      <ToolbarGroup>
        <UndoRedoButton action="undo" />
        <UndoRedoButton action="redo" />
      </ToolbarGroup>
      <ToolbarSeparator />
      <ToolbarGroup>
        <FontFamilyDropdown portal={isMobile} />
        <FontSizeDropdown portal={isMobile} />
        <LineHeightDropdown portal={isMobile} />
        <ListDropdownMenu
          types={["bulletList", "orderedList", "taskList"]}
          portal={isMobile}
        />
        <IndentButton direction="indent" />
        <IndentButton direction="outdent" />
        <TableDropdownMenu portal={isMobile} />
        <TableEditMenu portal={isMobile} />
        <BlockquoteButton />
        <CodeBlockButton />
      </ToolbarGroup>
      <ToolbarSeparator />
      <ToolbarGroup>
        <MarkButton type="bold" />
        <MarkButton type="italic" />
        <MarkButton type="strike" />
        <MarkButton type="code" />
        <MarkButton type="underline" />
        {!isMobile ? (
          <ColorHighlightPopover />
        ) : (
          <ColorHighlightPopoverButton onClick={onHighlighterClick} />
        )}
        {!isMobile ? <LinkPopover /> : <LinkButton onClick={onLinkClick} />}
        <RemoveFormattingButton />
      </ToolbarGroup>
      <ToolbarSeparator />
      <ToolbarGroup>
        <MarkButton type="superscript" />
        <MarkButton type="subscript" />
      </ToolbarGroup>
      <ToolbarSeparator />
      <ToolbarGroup>
        <TextAlignButton align="left" />
        <TextAlignButton align="center" />
        <TextAlignButton align="right" />
        <TextAlignButton align="justify" />
      </ToolbarGroup>
      <ToolbarSeparator />
      <ToolbarGroup>
        <ImageUploadButton />
        <PageBreakButton />
        <BookmarkButton portal={isMobile} />
        <HeadingDropdownMenu levels={[1, 2, 3, 4]} portal={isMobile} />
        <TocButton />
        <SpecialCharsButton portal={isMobile} />
      </ToolbarGroup>
      <ToolbarSeparator />
      <ToolbarGroup>
        <DocxImportButton />
        <HtmlImportButton />
        <DocxExportButton />
        <PdfExportButton />
        <ToolbarSeparator />
        <LanguageSwitcher />
      </ToolbarGroup>
      <Spacer />
    </>
  );
};

const MobileToolbarContent = ({ type, onBack }) => (
  <>
    <ToolbarGroup>
      <Button variant="ghost" onClick={onBack}>
        <ArrowLeftIcon className="tiptap-button-icon" />
        {type === "highlighter" ? (
          <HighlighterIcon className="tiptap-button-icon" />
        ) : (
          <LinkIcon className="tiptap-button-icon" />
        )}
      </Button>
    </ToolbarGroup>

    <ToolbarSeparator />

    {type === "highlighter" ? (
      <ColorHighlightPopoverContent />
    ) : (
      <LinkContent />
    )}
  </>
);

export function SimpleEditor({ responsive = true } = {}) {
  const { t } = useTranslation();
  const isMobile = useIsBreakpoint();
  const isCompact = useIsBreakpoint("max", 1024);
  const { height } = useWindowSize();
  const [mobileView, setMobileView] = useState("main");
  const toolbarRef = useRef(null);

  // Force light mode & expose editor for debugging
  useEffect(() => {
    document.documentElement.classList.remove("dark");
  }, []);

  const editor = useEditor({
    immediatelyRender: false,
    autofocus: true,
    editorProps: {
      attributes: {
        autocomplete: "off",
        autocorrect: "off",
        autocapitalize: "off",
        "aria-label": t("editor.ariaLabel"),
        class: "simple-editor",
      },
    },
    extensions: [
      StarterKit.configure({
        horizontalRule: false,
        underline: false,
        link: {
          openOnClick: false,
          enableClickSelection: true,
        },
      }),
      HorizontalRule,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Highlight.configure({ multicolor: true }),
      CustomImage,
      Typography,
      Superscript,
      Subscript,
      Underline,
      TextStyle,
      Color,
      FontFamily,
      FontSize,
      LineHeight,
      Indent,
      CustomTable.configure({ resizable: true }),
      TableRow,
      CustomTableCell,
      CustomTableHeader,
      TableLayout,
      RowResize,
      PageBreak,
      Bookmark,
      TableOfContents,
      Selection,
      ImageUploadNode.configure({
        accept: "image/*",
        maxSize: MAX_FILE_SIZE,
        limit: 3,
        upload: handleImageUpload,
        onError: (error) => { if (import.meta.env.DEV) console.error(error) },
      }),
    ],
    content: "<p></p>",
  });

  useEffect(() => {
    if (import.meta.env.DEV && editor) window.__editor = editor;
    return () => { if (import.meta.env.DEV) window.__editor = null; };
  }, [editor]);

  const rect = useCursorVisibility({
    editor,
    overlayHeight: toolbarRef.current?.getBoundingClientRect().height ?? 0,
  });

  useEffect(() => {
    if (!isMobile && mobileView !== "main") {
      setMobileView("main");
    }
  }, [isMobile, mobileView]);

  if (!responsive && isCompact) {
    return (
      <div className="simple-editor-wrapper">
        <div className="simple-editor-unavailable">
          <p>{t("editor.mobileNotAvailable")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="simple-editor-wrapper">
      <EditorContext.Provider value={{ editor }}>
        <Toolbar
          ref={toolbarRef}
          style={{
            ...(isMobile
              ? {
                  bottom: `calc(100% - ${height - rect.y}px)`,
                }
              : {}),
          }}
        >
          {mobileView === "main" ? (
            <MainToolbarContent
              onHighlighterClick={() => setMobileView("highlighter")}
              onLinkClick={() => setMobileView("link")}
              isMobile={isMobile}
              responsive={responsive}
            />
          ) : (
            <MobileToolbarContent
              type={mobileView === "highlighter" ? "highlighter" : "link"}
              onBack={() => setMobileView("main")}
            />
          )}
        </Toolbar>

        <div className="simple-editor-canvas">
          <EditorContent
            editor={editor}
            role="presentation"
            className="simple-editor-content"
          />
        </div>
      </EditorContext.Provider>
    </div>
  );
}
