import yaml from 'js-yaml';

export function validateSkillMd(content: string, expectedName: string): string[] {
  const errors: string[] = [];
  
  // Check for frontmatter block
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) {
    return ["Missing or malformed YAML frontmatter. It must start and end with '---'."];
  }

  const yamlString = match[1];
  let parsed: any;
  try {
    parsed = yaml.load(yamlString);
  } catch (e) {
    return ["Failed to parse YAML frontmatter."];
  }

  if (!parsed || typeof parsed !== 'object') {
    return ["YAML frontmatter must be an object."];
  }

  // Check name
  if (!parsed.name) {
    errors.push("Missing 'name' in frontmatter.");
  } else if (parsed.name !== expectedName) {
    errors.push(`Frontmatter 'name' ("${parsed.name}") does not match skill name ("${expectedName}").`);
  } else if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(parsed.name)) {
    errors.push(`Frontmatter 'name' ("${parsed.name}") is not valid kebab-case.`);
  }

  // Check description
  if (!parsed.description) {
    errors.push("Missing 'description' in frontmatter.");
  } else {
    if (parsed.description.length >= 1024) {
      errors.push("Frontmatter 'description' must be under 1024 characters.");
    }
    if (/<|>/.test(parsed.description)) {
      errors.push("Frontmatter 'description' must not contain XML tags (< or >).");
    }
  }

  return errors;
}
