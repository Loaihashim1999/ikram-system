<?php

$document = new DOMDocument;
if (! $document->loadXML('<root>safe</root>', LIBXML_NONET)) {
    throw new RuntimeException('DOM parsing failed.');
}
$schema = '<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema"><xs:element name="root" type="xs:string"/></xs:schema>';
if (! $document->schemaValidateSource($schema)) {
    throw new RuntimeException('XML schema validation failed.');
}
$xml = simplexml_load_string('<root><value>safe</value></root>', SimpleXMLElement::class, LIBXML_NONET);
if ((string) $xml->value !== 'safe') {
    throw new RuntimeException('SimpleXML parsing failed.');
}
$writer = new XMLWriter;
$writer->openMemory();
$writer->writeElement('root', 'safe');
if ($writer->outputMemory() !== '<root>safe</root>') {
    throw new RuntimeException('XMLWriter output failed.');
}
echo "PASS PHP DOM, XML schema, SimpleXML and XMLWriter with backported libxml2.so.2\n";
