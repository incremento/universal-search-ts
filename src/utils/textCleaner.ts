export function cleanText(text: string): string {
    if (typeof text !== 'string') return '';
    
    // Remove markdown image references [Image "..."]
    text = text.replace(/\[Image "[^"]*"\]/g, '');
    
    // Remove URLs/links (both markdown and plain)
    text = text.replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1'); // Remove markdown links but keep link text
    text = text.replace(/http[s]?:\/\/(?:[a-zA-Z]|[0-9]|[$-_@.&+]|[!*\\(\\),]|(?:%[0-9a-fA-F][0-9a-fA-F]))+/g, '');
    
    // Remove emojis (simplified approach)
    text = text.replace(/[\u{1F600}-\u{1F64F}|\u{1F300}-\u{1F5FF}|\u{1F680}-\u{1F6FF}|\u{2600}-\u{26FF}|\u{2700}-\u{27BF}]/gu, '');
    
    return text;
  }