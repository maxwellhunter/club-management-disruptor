import Markdown from "react-native-markdown-display";
import { StyleSheet } from "react-native";
import { Colors } from "@/constants/theme";

/**
 * Renders markdown content styled to fit inside chat bubbles.
 * Used for assistant messages so bold, lists, and headings display properly.
 */
export function ChatMarkdown({ children }: { children: string }) {
  return (
    <Markdown style={markdownStyles} mergeStyle>
      {children}
    </Markdown>
  );
}

const markdownStyles = StyleSheet.create({
  body: {
    fontSize: 14,
    lineHeight: 20,
    color: Colors.light.foreground,
  },
  paragraph: {
    marginTop: 0,
    marginBottom: 4,
  },
  strong: {
    fontWeight: "600",
  },
  heading3: {
    fontWeight: "600",
    fontSize: 15,
    marginTop: 8,
    marginBottom: 2,
  },
  heading4: {
    fontWeight: "600",
    fontSize: 14,
    marginTop: 6,
    marginBottom: 2,
  },
  bullet_list: {
    marginVertical: 4,
  },
  ordered_list: {
    marginVertical: 4,
  },
  list_item: {
    marginVertical: 1,
  },
  link: {
    color: Colors.light.primary,
  },
  blockquote: {
    borderLeftColor: Colors.light.border,
    borderLeftWidth: 3,
    paddingLeft: 10,
    marginVertical: 4,
    backgroundColor: "transparent",
  },
  code_inline: {
    backgroundColor: Colors.light.muted,
    borderRadius: 4,
    paddingHorizontal: 4,
    fontSize: 13,
    fontFamily: "monospace",
  },
  fence: {
    backgroundColor: Colors.light.muted,
    borderRadius: 8,
    padding: 10,
    fontSize: 13,
    fontFamily: "monospace",
    marginVertical: 4,
  },
  hr: {
    backgroundColor: Colors.light.border,
    height: 1,
    marginVertical: 8,
  },
});
