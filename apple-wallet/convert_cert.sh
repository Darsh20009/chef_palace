#!/bin/bash
# Run this after downloading pass.cer from Apple Developer
# Place pass.cer in this folder then run: bash apple-wallet/convert_cert.sh

set -e
DIR="$(cd "$(dirname "$0")" && pwd)"

echo "🔄 Converting pass.cer to signer_cert.pem..."

if [ ! -f "$DIR/pass.cer" ]; then
  echo "❌ Error: pass.cer not found in $DIR/"
  echo "   Please download the certificate from Apple Developer and place it here."
  exit 1
fi

# Try DER format first, then PEM
if openssl x509 -inform DER -in "$DIR/pass.cer" -out "$DIR/signer_cert.pem" 2>/dev/null; then
  echo "✅ Converted from DER format"
elif openssl x509 -inform PEM -in "$DIR/pass.cer" -out "$DIR/signer_cert.pem" 2>/dev/null; then
  echo "✅ Converted from PEM format"
else
  echo "❌ Failed to convert pass.cer. Make sure the file is a valid certificate."
  exit 1
fi

echo ""
echo "✅ All files ready:"
echo "   - apple-wallet/signer_cert.pem"
echo "   - apple-wallet/signer_key.pem"
echo "   - apple-wallet/wwdr.pem"
echo ""
echo "📋 Now add these as Secrets in Replit:"
echo "   Run: bash apple-wallet/show_secrets.sh"
