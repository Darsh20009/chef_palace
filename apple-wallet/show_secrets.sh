#!/bin/bash
# Shows the content of all secrets to add in Replit
# Run AFTER convert_cert.sh

DIR="$(cd "$(dirname "$0")" && pwd)"

echo "=========================================="
echo "  Replit Secrets — Apple Wallet Setup"
echo "=========================================="
echo ""

echo "Secret 1: APPLE_PASS_TYPE_ID"
echo "Value: pass.sa.blackrose.loyalty"
echo "------------------------------------------"
echo ""

echo "Secret 2: APPLE_TEAM_ID"
echo "Value: (from developer.apple.com/account → top right corner)"
echo "------------------------------------------"
echo ""

echo "Secret 3: APPLE_WWDR_PEM"
echo "Value:"
cat "$DIR/wwdr.pem" 2>/dev/null || echo "❌ wwdr.pem not found"
echo ""
echo "------------------------------------------"
echo ""

echo "Secret 4: APPLE_SIGNER_CERT_PEM"
echo "Value:"
cat "$DIR/signer_cert.pem" 2>/dev/null || echo "❌ signer_cert.pem not found — run convert_cert.sh first"
echo ""
echo "------------------------------------------"
echo ""

echo "Secret 5: APPLE_SIGNER_KEY_PEM"
echo "Value:"
cat "$DIR/signer_key.pem" 2>/dev/null || echo "❌ signer_key.pem not found"
echo ""
echo "=========================================="
echo "Copy each value above and add it as a"
echo "Secret in Replit (lock icon in sidebar)."
echo "=========================================="
