#include <stdio.h>
#include <string.h>
#include <libxml/tree.h>

/* The build extracts the exact source helper, before and after the backport. */
static void
#include "xml-snprint.inc"

int main(void) {
    unsigned char guarded[560];
    xmlNode node;
    memset(&node, 0, sizeof(node));
    node.name = BAD_CAST "bounded-security-regression-element";
    for (int kind = 0; kind < 2; kind++) {
        node.type = kind ? XML_ELEMENT_NODE : XML_COMMENT_NODE;
        for (int size = 1; size <= 512; size++) {
            for (int length = 0; length < size; length++) {
                for (int glob = 0; glob <= 1; glob++) {
                    memset(guarded, 0x5a, sizeof(guarded));
                    char *buf = (char *)guarded + 16;
                    memset(buf, 'a', length);
                    buf[length] = 0;
                    xmlSnprintfElements(buf, size, &node, glob);
                    for (int i = 0; i < 16; i++) {
                        if (guarded[i] != 0x5a || guarded[16 + size + i] != 0x5a) {
                            fprintf(stderr, "bounds violation: size=%d length=%d glob=%d\n", size, length, glob);
                            return 1;
                        }
                    }
                    if (memchr(buf, 0, size) == NULL) {
                        fprintf(stderr, "missing bounded terminator\n");
                        return 1;
                    }
                }
            }
        }
    }
    puts("PASS xmlSnprintfElements: 525312 bounded cases; prefix/suffix canaries preserved");
    return 0;
}
