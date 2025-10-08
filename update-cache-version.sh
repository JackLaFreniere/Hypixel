#!/bin/bash
# update-cache-version.sh
# Script to update cache busting versions across all HTML files

# Generate new version (current timestamp)
NEW_VERSION=$(date +"%Y%m%d%H%M")

echo "🔄 Updating cache busting version to: $NEW_VERSION"

# Update all HTML files
find . -name "*.html" -type f -exec sed -i.bak "s/?v=[^\"']*/?v=$NEW_VERSION/g" {} +

# Clean up backup files
find . -name "*.bak" -delete

echo "✅ Updated cache busting parameters in all HTML files"
echo "📁 Files updated:"
grep -r "?v=" --include="*.html" . | cut -d: -f1 | sort | uniq

echo ""
echo "🚀 Ready to commit and push to GitHub Pages!"
echo "   git add ."
echo "   git commit -m \"Update cache busting version to $NEW_VERSION\""
echo "   git push origin main"