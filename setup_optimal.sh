#!/bin/bash
# ==============================================================================
# Quick Setup Script - Optimal Config for Rank 1
# ==============================================================================

echo "🚀 Setting up optimal configuration..."
echo ""

# Copy example to .env.api
if [ -f ".env.api" ]; then
    echo "⚠️  .env.api already exists!"
    read -p "   Overwrite? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "❌ Cancelled. Keeping existing .env.api"
        exit 0
    fi
fi

cp .env.api.example .env.api
echo "✅ Created .env.api from template"
echo ""

# Prompt for username
echo "📝 Current username in config: zildjiannesta"
read -p "   Enter your Instagram username: " username

if [ ! -z "$username" ]; then
    # Update username in .env.api (works on Linux/Mac)
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        sed -i '' "s/MINIGAMES_USERNAME=.*/MINIGAMES_USERNAME=$username/" .env.api
    else
        # Linux
        sed -i "s/MINIGAMES_USERNAME=.*/MINIGAMES_USERNAME=$username/" .env.api
    fi
    echo "✅ Updated username to: $username"
else
    echo "⚠️  No username provided. Please edit .env.api manually:"
    echo "   nano .env.api"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Setup complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📊 Current configuration:"
echo "   • VUs: 5 (parallel exploitation)"
echo "   • Batch: 2-10 (adaptive)"
echo "   • Expected: 90,000-150,000 points/hour"
echo ""
echo "🚀 To start automation:"
echo "   ./start.sh api"
echo ""
echo "⚙️  To customize config:"
echo "   nano .env.api"
echo ""
echo "Good luck chasing rank 1! 🏆"
echo ""
