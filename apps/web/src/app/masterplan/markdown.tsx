import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function Markdown({ children }: { children: string }) {
  return (
    <div className="space-y-5 text-[15px] leading-7 text-foreground sm:text-base">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: (props) => (
            <h1
              className="mt-12 scroll-mt-24 font-serif text-4xl font-normal leading-tight first:mt-0"
              {...props}
            />
          ),
          h2: (props) => (
            <h2
              className="mt-12 scroll-mt-24 border-b border-border/80 pb-3 font-serif text-[2rem] font-normal leading-tight"
              {...props}
            />
          ),
          h3: (props) => (
            <h3
              className="mt-9 scroll-mt-24 font-serif text-[1.65rem] font-normal leading-snug"
              {...props}
            />
          ),
          h4: (props) => (
            <h4 className="mt-7 font-serif text-[1.28rem] font-normal" {...props} />
          ),
          p: (props) => <p className="leading-8 text-foreground/90" {...props} />,
          ul: (props) => (
            <ul className="ml-6 list-disc space-y-2.5 marker:text-primary/80" {...props} />
          ),
          ol: (props) => (
            <ol className="ml-6 list-decimal space-y-2.5 marker:text-primary/80" {...props} />
          ),
          li: (props) => <li className="leading-8" {...props} />,
          a: (props) => (
            <a
              className="font-medium text-primary underline decoration-primary/30 underline-offset-4 transition-colors hover:text-foreground"
              target={props.href?.startsWith("http") ? "_blank" : undefined}
              rel={props.href?.startsWith("http") ? "noreferrer" : undefined}
              {...props}
            />
          ),
          blockquote: (props) => (
            <blockquote
              className="rounded-r-2xl border-l-2 border-primary/40 bg-secondary/45 px-5 py-4 italic text-muted-foreground"
              {...props}
            />
          ),
          code: ({ className, children, ...props }) => {
            const isInline = !className;
            if (isInline) {
              return (
                <code
                  className="rounded-md bg-secondary px-1.5 py-0.5 font-mono text-[0.85em]"
                  {...props}
                >
                  {children}
                </code>
              );
            }
            return (
              <code className={className} {...props}>
                {children}
              </code>
            );
          },
          pre: (props) => (
            <pre
              className="overflow-x-auto rounded-2xl border border-border/80 bg-secondary/55 p-5 font-mono text-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.45)]"
              {...props}
            />
          ),
          table: (props) => (
            <div className="overflow-x-auto rounded-2xl border border-border/80">
              <table
                className="w-full border-collapse text-sm"
                {...props}
              />
            </div>
          ),
          th: (props) => (
            <th
              className="border border-border/80 bg-secondary px-3 py-2.5 text-left font-semibold"
              {...props}
            />
          ),
          td: (props) => (
            <td className="border border-border/80 px-3 py-2.5 align-top" {...props} />
          ),
          hr: (props) => <hr className="my-10 border-border/80" {...props} />,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
