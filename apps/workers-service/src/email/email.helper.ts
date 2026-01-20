/**
 * Generates the Frigate Fast Parts email HTML with a dynamic name.
 * @param {string} personName - The name of the recipient.
 * @returns {string} The complete HTML email template.
 */
export function generateFFPEmail(personName: string): string {
    // Ensure we handle empty names gracefully
    const displayName = personName ? personName : "Valued Customer";

    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <style>
            body { margin: 0; padding: 0; background-color: #f8fafc; font-family: sans-serif; color: #334155; }
            .wrapper { width: 100%; background-color: #f8fafc; padding: 40px 0; }
            .main { background-color: #ffffff; margin: 0 auto; width: 100%; max-width: 600px; border-top: 4px solid #007bff; border-radius: 4px; }
            .header { padding: 40px 20px; text-align: center; }
            .logo { width: 180px; margin: 0 auto; }
            .content { padding: 0 50px 40px 50px; }
            .content h1 { color: #0f172a; font-size: 22px; margin-bottom: 24px; }
            .content p { font-size: 16px; line-height: 1.6; margin-bottom: 20px; color: #475569; }
            .links-container { border-top: 1px solid #f1f5f9; padding: 40px 50px; background-color: #ffffff; }
            .link-item { display: block; padding: 12px 0; text-decoration: none; color: #007bff; font-weight: 500; border-bottom: 1px solid #f8fafc; }
            .footer { padding: 30px; text-align: center; font-size: 13px; color: #94a3b8; }
        </style>
    </head>
    <body>
        <div class="wrapper">
            <div class="main">
                <div class="header">
                    <img src="https://frigate.ai/wp-content/uploads/2025/03/FastParts-logo-1024x351.png" alt="Frigate Fast Parts" class="logo">
                </div>
                <div class="content">
                    <h1>Thank you for choosing FFP, ${displayName}.</h1>
                    <p>It’s a pleasure to support your production. At <strong>Frigate Fast Parts</strong>, we aim to combine engineering excellence with rapid delivery to keep your projects moving forward.</p>
                    <p>We’ve received your request, ${displayName}, and our team is already reviewing the technical specifications to ensure everything meets our standards.</p>
                    <p>We'll be in touch shortly with your next update.</p>
                </div>
                <div class="links-container">
                    <a href="#" class="link-item">📦 Track Your Current Order</a>
                    <a href="#" class="link-item">📄 Download Invoice/Quotes</a>
                    <a href="#" class="link-item">🛠 Contact Engineering Support</a>
                </div>
                <div class="footer">
                    &copy; 2026 Frigate Fast Parts. All rights reserved.
                </div>
            </div>
        </div>
    </body>
    </html>
    `;
}

