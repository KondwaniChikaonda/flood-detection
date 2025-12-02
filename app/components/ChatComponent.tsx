"use client";

import React, { useState, useRef, useEffect } from "react";

interface Message {
    role: "user" | "assistant";
    content: string;
}

interface ChatComponentProps {
    contextData: {
        scanResults: any[];
        rainfallUpdates: any[];
        riskInfo: any;
    };
}

const ChatComponent: React.FC<ChatComponentProps> = ({ contextData }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([
        { role: "assistant", content: "Hello! I'm your Flood Risk Assistant. Ask me about high-risk areas, rainfall, or safety guidelines." }
    ]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isOpen]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isLoading) return;

        const userMessage: Message = { role: "user", content: input };
        setMessages((prev) => [...prev, userMessage]);
        setInput("");
        setIsLoading(true);

        try {
            const res = await fetch("/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    messages: [...messages, userMessage],
                    context: contextData,
                }),
            });

            const data = await res.json();
            if (data.error) {
                throw new Error(data.error);
            }

            setMessages((prev) => [...prev, { role: "assistant", content: data.content }]);
        } catch (error) {
            console.error("Chat error:", error);
            setMessages((prev) => [...prev, { role: "assistant", content: "Sorry, I encountered an error. Please try again." }]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div style={{ position: "absolute", bottom: 20, right: 20, zIndex: 1000, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
            {!isOpen && (
                <button
                    onClick={() => setIsOpen(true)}
                    style={{
                        width: 60,
                        height: 60,
                        borderRadius: "50%",
                        background: "#0066cc",
                        color: "white",
                        border: "none",
                        boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 30,
                    }}
                >
                    🤖
                </button>
            )}

            {isOpen && (
                <div style={{
                    width: 350,
                    height: 500,
                    background: "white",
                    borderRadius: 12,
                    boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
                    display: "flex",
                    flexDirection: "column",
                    overflow: "hidden",
                    border: "1px solid #e0e0e0"
                }}>
                    {/* Header */}
                    <div style={{ padding: 16, background: "#0066cc", color: "white", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ fontWeight: 700 }}>Flood Risk Assistant</div>
                        <button
                            onClick={() => setIsOpen(false)}
                            style={{ background: "transparent", border: "none", color: "white", fontSize: 20, cursor: "pointer" }}
                        >
                            ×
                        </button>
                    </div>

                    {/* Messages */}
                    <div style={{ flex: 1, padding: 16, overflowY: "auto", background: "#f8f9fa" }}>
                        {messages.map((m, idx) => (
                            <div
                                key={idx}
                                style={{
                                    marginBottom: 12,
                                    display: "flex",
                                    justifyContent: m.role === "user" ? "flex-end" : "flex-start",
                                }}
                            >
                                <div
                                    style={{
                                        maxWidth: "80%",
                                        padding: "10px 14px",
                                        borderRadius: 12,
                                        fontSize: 14,
                                        lineHeight: "1.4",
                                        background: m.role === "user" ? "#0066cc" : "white",
                                        color: m.role === "user" ? "white" : "#333",
                                        border: m.role === "assistant" ? "1px solid #e0e0e0" : "none",
                                        borderBottomRightRadius: m.role === "user" ? 4 : 12,
                                        borderBottomLeftRadius: m.role === "assistant" ? 4 : 12,
                                        boxShadow: m.role === "assistant" ? "0 1px 2px rgba(0,0,0,0.05)" : "none"
                                    }}
                                >
                                    {m.content}
                                </div>
                            </div>
                        ))}
                        {isLoading && (
                            <div style={{ display: "flex", justifyContent: "flex-start", marginBottom: 12 }}>
                                <div style={{ background: "white", padding: "10px 14px", borderRadius: 12, border: "1px solid #e0e0e0", borderBottomLeftRadius: 4 }}>
                                    <span style={{ display: "inline-block", color: "black", animation: "pulse 1s infinite" }}>typing...</span>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input */}
                    <form onSubmit={handleSubmit} style={{ padding: 12, borderTop: "1px solid #e0e0e0", background: "white", display: "flex", gap: 8 }}>
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="Ask about floods or rainfall..."
                            style={{
                                flex: 1,
                                padding: "10px 14px",
                                borderRadius: 20,
                                border: "1px solid #ccc",
                                fontSize: 14,
                                color: "black",
                                outline: "none"
                            }}
                        />
                        <button
                            type="submit"
                            disabled={isLoading || !input.trim()}
                            style={{
                                background: isLoading || !input.trim() ? "#ccc" : "#0066cc",
                                color: "white",
                                border: "none",
                                borderRadius: "50%",
                                width: 40,
                                height: 40,
                                cursor: isLoading || !input.trim() ? "not-allowed" : "pointer",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center"
                            }}
                        >
                            ➤
                        </button>
                    </form>
                </div>
            )}
        </div>
    );
};

export default ChatComponent;
