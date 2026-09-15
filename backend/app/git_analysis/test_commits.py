from app.git_analysis.commits import analyze_git_history

result = analyze_git_history("..")

print("\nGit history:")
for path, data in list(result.items())[:10]:
    print(path, data)